from datetime import date, timedelta
import calendar
from django.db.models import Sum
from .models import Expense, RecurringExpense
from django.db import transaction
from budgets.models import Budget
def process_recurring_expenses():
    today = date.today()
    due_recurring = RecurringExpense.objects.filter(
        active=True, 
        next_due__lte=today
    )

    for recurring in due_recurring:
        with transaction.atomic():
            # 1. Main Expense table me naya expense auto-generate hoga
            Expense.objects.create(
                owner=recurring.owner,
                title=recurring.title,
                amount=recurring.amount,
                category=recurring.category,
                date=recurring.next_due,
                payment_method=recurring.payment_method,
                description=f"Auto-generated recurring expense: {recurring.description}".strip(),
                is_recurring=True,
                recurrence_type=recurring.frequency.lower()
            )

            # 2. Key Step: Agli Due Date Recalculate karke update karega
            recurring.next_due = recurring.calculate_next_due_date()
            recurring.save()

def get_ordinal_suffix(day_num):
    """Formats 1 -> '1st', 2 -> '2nd', 3 -> '3rd', 11 -> '11th' etc."""
    if 11 <= day_num <= 13:
        return f"{day_num}th"
    suffixes = {1: 'st', 2: 'nd', 3: 'rd'}
    return f"{day_num}{suffixes.get(day_num % 10, 'th')}"


def generate_smart_insights(user):
    today = date.today()
    current_year = today.year
    current_month = today.month

    # Date calculations
    current_month_start = date(current_year, current_month, 1)
    days_in_current_month = calendar.monthrange(current_year, current_month)[1]

    last_month_end = current_month_start - timedelta(days=1)
    last_month_start = date(last_month_end.year, last_month_end.month, 1)

    insights = []

    # ==========================================
    # 1. CATEGORY COMPARISON (OPTIMIZED)
    # ==========================================
    # Current month category totals
    curr_cat_expenses = (
        Expense.objects.filter(owner=user, date__range=[current_month_start, today])
        .values('category__name')
        .annotate(total=Sum('amount'))
    )

    # Fetch ALL previous month category totals in 1 Query
    prev_cat_expenses = {
        item['category__name'] or 'Uncategorized': item['total'] or 0
        for item in (
            Expense.objects.filter(owner=user, date__range=[last_month_start, last_month_end])
            .values('category__name')
            .annotate(total=Sum('amount'))
        )
    }

    for item in curr_cat_expenses:
        cat_name = item['category__name'] or 'Uncategorized'
        curr_total = item['total'] or 0
        prev_total = prev_cat_expenses.get(cat_name, 0)

        if prev_total > 0 and curr_total > prev_total:
            percent_increase = round(((curr_total - prev_total) / prev_total) * 100)
            if percent_increase >= 15:
                insights.append({
                    "type": "category_warning",
                    "message": f"You spent {percent_increase}% more on {cat_name} this month."
                })

    # ==========================================
    # 2. VENDOR/TITLE COMPARISON (OPTIMIZED)
    # ==========================================
    # Current month vendor totals
    curr_vendor_expenses = (
        Expense.objects.filter(owner=user, date__range=[current_month_start, today])
        .values('title')
        .annotate(total=Sum('amount'))
    )

    # Fetch ALL previous month vendor totals in 1 Query
    prev_vendor_expenses = {
        item['title'].lower(): item['total'] or 0
        for item in (
            Expense.objects.filter(owner=user, date__range=[last_month_start, last_month_end])
            .values('title')
            .annotate(total=Sum('amount'))
        )
    }

    for item in curr_vendor_expenses:
        title = item['title']
        curr_total = item['total'] or 0
        prev_total = prev_vendor_expenses.get(title.lower(), 0)

        diff = curr_total - prev_total
        if diff > 1000:
            insights.append({
                "type": "vendor_increase",
                "message": f"Your {title} expenses increased by PKR {diff:,.0f}."
            })

    # ==========================================
    # 3. BUDGET PROJECTION & BURN RATE
    # ==========================================
    current_month_budget = Budget.objects.filter(
        owner=user, 
        month=current_month, 
        year=current_year
    ).first()

    if current_month_budget and current_month_budget.amount > 0:
        budget_limit = float(current_month_budget.amount)
        spent_so_far = float(
            Expense.objects.filter(owner=user, date__range=[current_month_start, today])
            .aggregate(total=Sum('amount'))['total'] or 0
        )

        days_passed = today.day
        if days_passed > 0 and spent_so_far > 0:
            daily_burn_rate = spent_so_far / days_passed
            projected_total = daily_burn_rate * days_in_current_month

            if projected_total > budget_limit:
                day_budget_exceeded = int(budget_limit / daily_burn_rate)
                
                if days_passed <= day_budget_exceeded <= days_in_current_month:
                    day_str = get_ordinal_suffix(day_budget_exceeded)
                    insights.append({
                        "type": "budget_projection",
                        "message": f"If you continue at this rate, you'll exceed your monthly budget by the {day_str}."
                    })
                elif day_budget_exceeded < days_passed:
                    insights.append({
                        "type": "budget_exceeded",
                        "message": "You have already exceeded your overall monthly budget!"
                    })

    return insights