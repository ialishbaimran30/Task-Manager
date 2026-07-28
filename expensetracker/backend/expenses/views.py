import calendar
from datetime import date,timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Max, Min, Q
from django.db import transaction
from django.core.cache import cache
from django.contrib.auth.models import User
from django.apps import apps
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import (
    Category, Expense, RecurringExpense, SplitGroup, 
    GroupMember, GroupExpense, ExpenseSplit, GroupSettlement, GroupInvite,PaymentMethod
)
from .serializers import (
    CategorySerializer, ExpenseSerializer, RecurringExpenseSerializer,
    SplitGroupSerializer, GroupExpenseSerializer, SettlementSerializer, GroupInviteSerializer
)
from budgets.models import Budget
from .filters import ExpenseFilter
from dateutil.relativedelta import relativedelta
from .services import process_recurring_expenses


def dashboard_cache_key(user_id):
    return f"expense_dashboard_{user_id}"


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(owner=self.request.user)


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ExpenseFilter
    search_fields = ["title", "description"]
    ordering_fields = ["amount", "date", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        process_recurring_expenses()
        return Expense.objects.filter(owner=self.request.user, is_deleted=False).order_by('-date')

    def perform_create(self, serializer):
        expense = serializer.save(owner=self.request.user)
        raw_type = (
            self.request.data.get('recurrence_type') or 
            self.request.data.get('frequency') or 
            getattr(expense, 'recurrence_type', 'monthly') or 
            'monthly'
        )

        if expense.is_recurring:
            freq_str = str(raw_type).lower()
            
            freq_map = {
                'daily': RecurringExpense.Frequency.DAILY,
                'weekly': RecurringExpense.Frequency.WEEKLY,
                'monthly': RecurringExpense.Frequency.MONTHLY,
                'yearly': RecurringExpense.Frequency.YEARLY,
            }
            freq = freq_map.get(freq_str, RecurringExpense.Frequency.MONTHLY)
            if freq == RecurringExpense.Frequency.DAILY:
                next_due = expense.date + relativedelta(days=1)
            elif freq == RecurringExpense.Frequency.WEEKLY:
                next_due = expense.date + relativedelta(weeks=1)
            elif freq == RecurringExpense.Frequency.MONTHLY:
                next_due = expense.date + relativedelta(months=1)
            elif freq == RecurringExpense.Frequency.YEARLY:
                next_due = expense.date + relativedelta(years=1)
            else:
                next_due = expense.date + relativedelta(months=1)

            RecurringExpense.objects.get_or_create(
                owner=self.request.user,
                title=expense.title,
                amount=expense.amount,
                defaults={
                    'category': expense.category,
                    'payment_method': expense.payment_method,
                    'description': expense.description,
                    'frequency': freq,
                    'start_date': expense.date,
                    'next_due': next_due,
                    'active': True
                }
            )

        cache.delete(dashboard_cache_key(self.request.user.id))


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        expense = serializer.save()

        if expense.is_recurring and expense.recurrence_type:
            recurring_exists = RecurringExpense.objects.filter(
                owner=self.request.user, 
                title=expense.title, 
                amount=expense.amount
            ).exists()

            if not recurring_exists:
                freq_map = {
                    'daily': RecurringExpense.Frequency.DAILY,
                    'weekly': RecurringExpense.Frequency.WEEKLY,
                    'monthly': RecurringExpense.Frequency.MONTHLY,
                    'yearly': RecurringExpense.Frequency.YEARLY,
                }
                freq = freq_map.get(expense.recurrence_type.lower(), RecurringExpense.Frequency.MONTHLY)
                if freq == RecurringExpense.Frequency.DAILY:
                    next_due = expense.date + relativedelta(days=1)
                elif freq == RecurringExpense.Frequency.WEEKLY:
                    next_due = expense.date + relativedelta(weeks=1)
                elif freq == RecurringExpense.Frequency.MONTHLY:
                    next_due = expense.date + relativedelta(months=1)
                elif freq == RecurringExpense.Frequency.YEARLY:
                    next_due = expense.date + relativedelta(years=1)
                else:
                    next_due = expense.date + relativedelta(months=1)

                RecurringExpense.objects.create(
                    owner=self.request.user,
                    title=expense.title,
                    amount=expense.amount,
                    category=expense.category,
                    payment_method=expense.payment_method,
                    description=expense.description,
                    frequency=freq,
                    start_date=expense.date,
                    next_due=next_due,
                    active=True
                )

        cache.delete(dashboard_cache_key(self.request.user.id))

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()
        cache.delete(dashboard_cache_key(self.request.user.id))


class ExpenseDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cache_key = dashboard_cache_key(request.user.id)
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        queryset = Expense.objects.filter(owner=request.user, is_deleted=False)
        today = timezone.now().astimezone().date()

        data = {
            "total_expense": queryset.aggregate(total=Sum("amount"))["total"] or 0,
            "today_expense": queryset.filter(date=today).aggregate(total=Sum("amount"))["total"] or 0,
            "highest_expense": queryset.aggregate(highest=Max("amount"))["highest"] or 0,
            "lowest_expense": queryset.aggregate(lowest=Min("amount"))["lowest"] or 0,
            "total_categories": queryset.values("category").distinct().count(),
            "total_expenses": queryset.count(),
        }
        cache.set(cache_key, data, timeout=60)
        return Response(data)


class RecurringExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = RecurringExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RecurringExpense.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class RecurringExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RecurringExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RecurringExpense.objects.filter(owner=self.request.user)


class UpcomingRecurringExpenseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        recurring = RecurringExpense.objects.filter(owner=request.user, next_due_date__gte=today, is_active=True).order_by("next_due_date")
        return Response(RecurringExpenseSerializer(recurring, many=True).data)


class ExpenseInsightsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            today = timezone.now().date()
            current_year = today.year
            current_month = today.month

            current_month_start = date(current_year, current_month, 1)
            days_in_current_month = calendar.monthrange(current_year, current_month)[1]
            days_passed = max(today.day, 1)

            last_month_end = current_month_start - timedelta(days=1)
            last_month_start = date(last_month_end.year, last_month_end.month, 1)

            insights = []


            curr_budget_obj = Budget.objects.filter(
                owner=user,
                month=current_month,
                year=current_year
            ).first()

            prev_budget_obj = Budget.objects.filter(
                owner=user,
                month=last_month_end.month,
                year=last_month_end.year
            ).first()

            curr_budget = Decimal(str(getattr(curr_budget_obj, 'monthly_budget', 0) or 0))
            prev_budget = Decimal(str(getattr(prev_budget_obj, 'monthly_budget', 0) or 0))

            curr_expenses = Expense.objects.filter(
                owner=user, is_deleted=False, date__year=current_year,date__month=current_month
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            prev_expenses = Expense.objects.filter(
                owner=user, is_deleted=False, date__range=[last_month_start, last_month_end]
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            if curr_budget > 0 or prev_budget > 0 or curr_expenses > 0:
                if prev_budget > 0:
                    budget_diff_pct = round(((curr_budget - prev_budget) / prev_budget) * Decimal("100"), 1)
                else:
                    budget_diff_pct = Decimal("100.0") if curr_budget > 0 else Decimal("0.0")

                if prev_expenses > 0:
                    expense_diff_pct = round(((curr_expenses - prev_expenses) / prev_expenses) * Decimal("100"), 1)
                else:
                    expense_diff_pct = Decimal("100.0") if curr_expenses > 0 else Decimal("0.0")

                budget_status = "increased" if budget_diff_pct >= 0 else "decreased"
                expense_status = "more" if expense_diff_pct >= 0 else "less"

                if curr_budget > 0:
                    msg = (
                        f"Your current month budget is PKR {curr_budget:,.0f} "
                        f"({abs(budget_diff_pct)}% {budget_status} vs last month). "
                        f"Total spent so far: PKR {curr_expenses:,.0f} "
                        f"({abs(expense_diff_pct)}% {expense_status} than last month)."
                    )
                else:
                    msg = f"No budget set for this month yet. Last month's budget was PKR {prev_budget:,.0f}."

                insights.append({
                    "id": "budget_comparison",
                    "type": "budget_comparison",
                    "title": "Monthly Financial Overview",
                    "message": msg,
                    # "formula_text": "Formula: % Change = ((Current Month - Previous Month) ÷ Previous Month) × 100"
                })

        #    2Track expense
            tracked_expenses = Expense.objects.filter(
                owner=user,
                is_deleted=False,
                is_tracked_in_insights=True,
                date__range=[current_month_start, today]
            ).values("title").annotate(total=Sum("amount"))

            for item in tracked_expenses:
                item_total = item['total'] or Decimal("0.00")
                insights.append({
                    "id": f"tracked_{item['title']}",
                    "type": "tracked_expense",
                    "title": f"Tracked Expense: {item['title']}",
                    "message": f"Your tracked expense '{item['title']}' total for this month is PKR {item_total:,.0f}."
                })

        #3 burn rate
            if curr_budget > 0 and days_passed > 0:
                daily_burn_rate = curr_expenses / Decimal(str(days_passed))
                projected_total = daily_burn_rate * Decimal(str(days_in_current_month))

                if curr_expenses >= curr_budget:
                    msg = f"Alert! You have already exceeded your monthly budget of PKR {curr_budget:,.0f}!"
                    exceed_day = days_passed
                elif projected_total > curr_budget and daily_burn_rate > 0:
                    exceed_day_calculated = int(curr_budget / daily_burn_rate)
                    exceed_day = max(1, min(exceed_day_calculated, days_in_current_month))
                    msg = (
                        f"If you continue spending at PKR {daily_burn_rate:,.0f}/day, "
                        f"you will exceed your budget by the {exceed_day}th of this month."
                    )
                else:
                    exceed_day = None
                    msg = "Good job! You are currently on track to stay within your monthly budget."

                insights.append({
                    "id": "daily_projection",
                    "type": "projection",
                    "title": "Daily Spending Rate",
                    # "formula_text": "Formula: Exceed Date = Math.ceil(Total Budget ÷ Daily Average Spend)",
                    "message": msg,
                    "formula": {
                        "daily_burn_rate": float(round(daily_burn_rate, 2)),
                        "days_passed": days_passed,
                        "days_in_month": days_in_current_month,
                        "spent_so_far": float(curr_expenses),
                        "budget": float(curr_budget),
                        "projected_total": float(round(projected_total, 2)),
                        "exceed_day": exceed_day,
                    },
                })

            return Response({"insights": insights}, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"insights": [], "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
def recalculate_group_equal_splits(group):
    members = list(group.members.all())
    member_count = len(members)
    if member_count == 0:
        return

    equal_expenses = GroupExpense.objects.filter(group=group, split_type="EQUAL")
    for exp in equal_expenses:
        exp.splits.all().delete()
        split_amt = round(exp.total_amount / Decimal(str(member_count)), 2)
        remainder = exp.total_amount - (split_amt * Decimal(str(member_count)))

        for idx, m in enumerate(members):
            amt = split_amt + remainder if idx == 0 else split_amt
            ExpenseSplit.objects.create(
                expense=exp,
                user=m,
                amount_owed=amt
            )


def compute_group_settlements(group_id):
    members = GroupMember.objects.filter(group_id=group_id).values_list('user_id', flat=True)
    balances = {u_id: Decimal('0.00') for u_id in members}

    expenses = GroupExpense.objects.filter(group_id=group_id).prefetch_related('splits')
    for exp in expenses:
        if exp.paid_by_id in balances:
            balances[exp.paid_by_id] += exp.total_amount

        for split in exp.splits.all():
            if split.user_id in balances:
                balances[split.user_id] -= split.amount_owed

    settlements = GroupSettlement.objects.filter(group_id=group_id, is_settled=True)
    for st in settlements:
        if st.payer_id in balances:
            balances[st.payer_id] += st.amount
        if st.payee_id in balances:
            balances[st.payee_id] -= st.amount

    debtors = []
    creditors = []

    for user_id, bal in balances.items():
        if bal < Decimal('-0.01'):
            debtors.append([user_id, abs(bal)])
        elif bal > Decimal('0.01'):
            creditors.append([user_id, bal])

    simplified_settlements = []
    i, j = 0, 0

    while i < len(debtors) and j < len(creditors):
        d_user, d_amt = debtors[i]
        c_user, c_amt = creditors[j]

        settle_amt = min(d_amt, c_amt)
        
        simplified_settlements.append({
            "from_user": d_user,
            "to_user": c_user,
            "amount": round(settle_amt, 2)
        })

        debtors[i][1] -= settle_amt
        creditors[j][1] -= settle_amt

        if debtors[i][1] < Decimal('0.01'):
            i += 1
        if creditors[j][1] < Decimal('0.01'):
            j += 1

    return balances, simplified_settlements


class SplitGroupListCreateView(generics.ListCreateAPIView):
    serializer_class = SplitGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SplitGroup.objects.filter(members=self.request.user)

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        # group.members.add(self.request.user)
        GroupMember.objects.create(group=group, user=self.request.user)


class AddGroupMemberView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, group_id):
        username_or_email = request.data.get("user_identifier")
        try:
            user = User.objects.get(Q(username=username_or_email) | Q(email=username_or_email))
            group = SplitGroup.objects.get(id=group_id, members=request.user)
            GroupMember.objects.get_or_create(group=group, user=user)
            recalculate_group_equal_splits(group)
            
            return Response({"message": "User added successfully!"}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class GroupExpenseCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, group_id):
        try:
            group = SplitGroup.objects.get(id=group_id)
        except SplitGroup.DoesNotExist:
            return Response({"error": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        split_type = data.get("split_type", "EQUAL")
        total_amount = Decimal(str(data.get("total_amount", 0)))

        paid_by_id = data.get("paid_by")
        if not paid_by_id:
            paid_by_id = request.user.id

        expense = GroupExpense.objects.create(
            group=group,
            title=data.get("title"),
            total_amount=total_amount,
            paid_by_id=paid_by_id,
            split_type=split_type,
            description=data.get("description", ""),
        )

        members = list(group.members.all())
        member_count = len(members)

        if member_count == 0:
            return Response({"error": "Group has no members."}, status=status.HTTP_400_BAD_REQUEST)

        if split_type == "EQUAL":
            split_amt = round(total_amount / Decimal(str(member_count)), 2)
            remainder = total_amount - (split_amt * Decimal(str(member_count)))

            for idx, m in enumerate(members):
                amt = split_amt + remainder if idx == 0 else split_amt
                ExpenseSplit.objects.create(
                    expense=expense,
                    user=m,
                    amount_owed=amt,
                )

        elif split_type == "SELECTED":
            selected_users = [s["user_id"] for s in data.get("splits", []) if s.get("user_id")]
            if not selected_users:
                selected_users = [m.id for m in members]

            split_amt = round(total_amount / Decimal(str(len(selected_users))), 2)
            for uid in selected_users:
                ExpenseSplit.objects.create(expense=expense, user_id=uid, amount_owed=split_amt)

        elif split_type == "EXACT":
            for s in data.get("splits", []):
                val = s.get("value") if s.get("value") not in [None, ""] else 0
                ExpenseSplit.objects.create(expense=expense, user_id=s["user_id"], amount_owed=Decimal(str(val)))

        elif split_type == "PERCENT":
            for s in data.get("splits", []):
                val = s.get("value") if s.get("value") not in [None, ""] else 0
                amt = round((total_amount * Decimal(str(val))) / Decimal("100"), 2)
                ExpenseSplit.objects.create(expense=expense, user_id=s["user_id"], amount_owed=amt)

        return Response(GroupExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)

class GroupBalancesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        balances, settlements = compute_group_settlements(group_id)
        
        populated_settlements = []
        for s in settlements:
            from_u = User.objects.get(id=s["from_user"])  
            to_u = User.objects.get(id=s["to_user"])     
            
            relevant_expenses = GroupExpense.objects.filter(
                group_id=group_id,
                paid_by=to_u, 
                splits__user=from_u
            ).values_list('title', flat=True).distinct()

            if relevant_expenses:
                title_summary = ", ".join(relevant_expenses)
            else:
                title_summary = "Group Expenses"

            populated_settlements.append({
                "from_user_id": from_u.id,
                "from_username": from_u.username,
                "to_user_id": to_u.id,
                "to_username": to_u.username,
                "amount": s["amount"],
                "expense_titles": title_summary  
            })

        return Response({
            "my_net_balance": balances.get(request.user.id, Decimal('0.00')),
            "who_owes_whom": populated_settlements
        })


class RecordSettlementView(generics.CreateAPIView):
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def perform_create(self, serializer):
       
        settlement = serializer.save()

        payer = settlement.payer
        payee = settlement.payee
        amount = settlement.amount
        group_name = settlement.group.name if settlement.group else "Split Group"
        today = timezone.now().date()

        # 2. PAYER SIDE: Personal Expense create karein (Spent Increase -> Remaining Decrease)

        payer_category, _ = Category.objects.get_or_create(
            owner=payer,
            name="Split Bill Settlement"
        )
        Expense.objects.create(
            owner=payer,
            title=f"Settlement Paid to @{payee.username} ({group_name})",
            amount=amount,
            category=payer_category,
            date=today,
            payment_method=PaymentMethod.CASH,
            description=f"Automated settlement paid in group '{group_name}'."
        )

        # -------------------------------------------------------------
        # 3. PAYEE SIDE: 'budgets' app se Budget fetch karke Total Monthly Budget Increase karein
        # -------------------------------------------------------------
        try:
            BudgetModel = apps.get_model('budgets', 'Budget')
            payee_budget = BudgetModel.objects.filter(
                owner=payee,
                month=today.month,
                year=today.year
            ).first()

            if payee_budget:
                payee_budget.monthly_budget += amount
                payee_budget.save()          
                cache.delete(f"budget_summary_{payee_budget.id}")
        except Exception as e:
            print(f"Error updating Payee Budget: {e}")

        payee_category, _ = Category.objects.get_or_create(
            owner=payee,
            name="Split Bill Received"
        )
        # Note: negative amount lagane se ya dynamic text se Sara ko confirmation mil jayegi
        Expense.objects.create(
            owner=payee,
            title=f"Received Settlement from @{payer.username} ({group_name})",
            amount=amount,
            category=payee_category,
            date=today,
            payment_method=PaymentMethod.CASH,
            description=f"Received Rs {amount} settlement from @{payer.username}."
        )

        try:
            NotificationModel = apps.get_model('notifications', 'Notification') # Adjust app_name if different
            NotificationModel.objects.create(
                user=payee,
                title="Payment Received! 💰",
                message=f"@{payer.username} has settled Rs {amount} with you in '{group_name}'.",
                is_read=False
            )
        except Exception as e:
            # Agar aap ke app name mein 'notifications' model alag hai, yahan handle ho jaye ga
            print(f"Notification error: {e}")

        
        cache.delete(dashboard_cache_key(payer.id))
        cache.delete(dashboard_cache_key(payee.id))


class SendGroupInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, group_id):
        username_or_email = request.data.get("user_identifier")
        try:
            receiver = User.objects.get(Q(username=username_or_email) | Q(email=username_or_email))
            group = SplitGroup.objects.get(id=group_id, members=request.user)

            if receiver in group.members.all():
                return Response({"error": "User is already in the group."}, status=status.HTTP_400_BAD_REQUEST)

            invite, created = GroupInvite.objects.get_or_create(
                group=group,
                sender=request.user,
                receiver=receiver,
                defaults={"status": GroupInvite.StatusChoices.PENDING}
            )

            if not created and invite.status == GroupInvite.StatusChoices.REJECTED:
                invite.status = GroupInvite.StatusChoices.PENDING
                invite.save()

            return Response({"message": f"Invite sent to {receiver.username}!"}, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "Username/Email not found."}, status=status.HTTP_404_NOT_FOUND)
        except SplitGroup.DoesNotExist:
            return Response({"error": "Group not found or you are not a member."}, status=status.HTTP_404_NOT_FOUND)


class UserPendingInvitesView(generics.ListAPIView):
    serializer_class = GroupInviteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupInvite.objects.filter(receiver=self.request.user, status=GroupInvite.StatusChoices.PENDING)


class RespondGroupInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, invite_id):
        action = request.data.get("action")
        try:
            invite = GroupInvite.objects.get(id=invite_id, receiver=request.user)

            if action == "ACCEPT":
                invite.status = GroupInvite.StatusChoices.ACCEPTED
                GroupMember.objects.get_or_create(group=invite.group, user=request.user)
                invite.save()

                recalculate_group_equal_splits(invite.group)

                return Response({"message": "Joined group successfully!"}, status=status.HTTP_200_OK)

            elif action == "REJECT":
                invite.status = GroupInvite.StatusChoices.REJECTED
                invite.save()
                return Response({"message": "Invite rejected."}, status=status.HTTP_200_OK)

            return Response({"error": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

        except GroupInvite.DoesNotExist:
            return Response({"error": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)


class GroupDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        try:
            group = SplitGroup.objects.get(id=group_id, members=request.user)
            is_owner = (group.created_by == request.user)
            
            # Invites status handling (Only for Owner)
            invites_data = []
            if is_owner:
                invites = GroupInvite.objects.filter(group=group)
                invites_data = [
                    {
                        "id": inv.id,
                        "receiver_username": inv.receiver.username,
                        "status": inv.status
                    } for inv in invites
                ]

            return Response({
                "id": group.id,
                "name": group.name,
                "group_type": getattr(group, 'group_type', 'Trip'),
                "created_by": group.created_by.id,
                "is_owner": is_owner,
                "invites": invites_data
            })
        except SplitGroup.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, group_id):
        try:
            group = SplitGroup.objects.get(id=group_id)
            # 🟢 Check only owner can delete
            if group.created_by != request.user:
                return Response({"error": "Only the group owner can delete this group."}, status=status.HTTP_403_FORBIDDEN)
            
            group.delete()
            return Response({"message": "Group deleted successfully"}, status=status.HTTP_204_NO_CONTENT)
        except SplitGroup.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)

class LeaveGroupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, group_id):
        try:
            group = SplitGroup.objects.get(id=group_id, members=request.user)
            if group.created_by == request.user:
                return Response(
                    {"error": "Group owner cannot leave. Delete the group instead."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Remove user from group members
            group.members.remove(request.user)
            GroupMember.objects.filter(group=group, user=request.user).delete()
            
            # 🟢 3. Clear ALL previous invitations for this user & group
            # (Apne model ka naam check kar lein: GroupInvite / Invitation / GroupPendingInvite)
            GroupInvite.objects.filter(group=group, receiver=request.user).delete()
            recalculate_group_equal_splits(group)
            return Response({"message": "Left group successfully!"}, status=status.HTTP_200_OK)
        except SplitGroup.DoesNotExist:
            return Response({"error": "Group not found."}, status=status.HTTP_404_NOT_FOUND)