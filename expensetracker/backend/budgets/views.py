from django.db.models import Sum
from django.db.models.functions import ExtractMonth, ExtractYear
from django.core.cache import cache
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from notifications.services import send_notification
from .models import Budget
from .serializers import BudgetSerializer
from expenses.models import Expense
# Create your views here.

def budget_summary_cache_key(budget_id):
    return f"budget_summary_{budget_id}"


class BudgetListCreateView(generics.ListCreateAPIView):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class BudgetDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        serializer.save()
        cache.delete(budget_summary_cache_key(serializer.instance.id))

    def perform_destroy(self, instance):
        cache.delete(budget_summary_cache_key(instance.id))
        instance.delete()


class BudgetMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "username": request.user.username,
            "id": request.user.id,
        })


class BudgetSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        cache_key = budget_summary_cache_key(pk)
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        budget = Budget.objects.get(pk=pk, owner=request.user)

        total_spent = (
            Expense.objects.filter(
                owner=request.user,
                date__month=budget.month,
                date__year=budget.year,
                is_deleted=False,
            ).aggregate(total=Sum("amount"))["total"] or 0
        )

        remaining = budget.monthly_budget - total_spent

        percentage = (
            (total_spent / budget.monthly_budget) * 100
            if budget.monthly_budget
            else 0
        )

        warning = "Safe"

        if percentage >= 100:
            warning = "Budget Exceeded"
        elif percentage >= 90:
            warning = "Critical"
        elif percentage >= 80:
            warning = "Warning"

        data = {
            "budget": budget.monthly_budget,
            "spent": total_spent,
            "remaining": remaining,
            "used_percentage": round(percentage, 2),
            "status": warning,
        }

        cache.set(cache_key, data, timeout=30)

        return Response(data)