from django.core.cache import cache
from django.db.models import Sum

from .models import Budget
from notifications.utils import notify_user


def check_and_notify_budget_status(user, expense_date):

    from expenses.models import Expense  
    try:
        budget = Budget.objects.get(
            owner=user, month=expense_date.month, year=expense_date.year
        )
    except Budget.DoesNotExist:
        return

    cache.delete(f"budget_summary_{budget.id}")

    total_spent = Expense.objects.filter(
        owner=user,
        date__month=budget.month,
        date__year=budget.year,
        is_deleted=False,
    ).aggregate(total=Sum("amount"))["total"] or 0

    percentage = (
        (total_spent / budget.monthly_budget) * 100
        if budget.monthly_budget
        else 0
    )
    remaining = budget.monthly_budget - total_spent

    updated = False

    if percentage >= 100 and not budget.notified_exceeded:
        notify_user(user.id, "budget_exceeded", "Budget exceeded.")
        budget.notified_exceeded = True
        updated = True

    elif percentage >= 90 and not budget.notified_90:
        notify_user(user.id, "budget_90", "You have used 90% of your monthly budget.")
        notify_user(user.id, "budget_remaining", f"Only Rs. {remaining} budget remaining")
        budget.notified_90 = True
        updated = True

    elif percentage >= 80 and not budget.notified_80:
        notify_user(user.id, "budget_80", "You have used 80% of your monthly budget.")
        notify_user(user.id, "budget_remaining", f"Only Rs. {remaining} budget remaining")
        budget.notified_80 = True
        updated = True

    elif percentage >= 50 and not budget.notified_50:
        notify_user(user.id, "budget_50", "You have used 50% of your monthly budget.")
        budget.notified_50 = True
        updated = True

    if updated:
        budget.save()