from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Sum
from django.utils import timezone
from .models import Expense  # Apka Expense model
from notifications.models import Notification  # Apka Notification model

@receiver(post_save, sender=Expense)
def check_budget_and_notify(sender, instance, created, **kwargs):
    # Sirf naye expense add hone par trigger hoga
    if not created:
        return

    # FIX: 'user' ki jagah 'owner' use karein
    owner = getattr(instance, 'owner', None)
    if not owner:
        return

    now = timezone.now()
    
    # Owner ka monthly budget check karein
    monthly_budget = getattr(owner, 'monthly_budget', 0)
    if not monthly_budget or monthly_budget <= 0:
        return

    # Owner ke is month ke total expenses
    total_spent = Expense.objects.filter(
        owner=owner,
        date__year=now.year,
        date__month=now.month
    ).aggregate(total=Sum('amount'))['total'] or 0

    # Percentage Calculation
    percentage_used = (total_spent / monthly_budget) * 100

    # Notification Conditions
    if 80 <= percentage_used < 90:
        already_notified = Notification.objects.filter(
            user=owner,
            title="Warning",
            created_at__year=now.year,
            created_at__month=now.month
        ).exists()

        if not already_notified:
            Notification.objects.create(
                user=owner,
                title="Warning",
                message=f"You have used {int(percentage_used)}% of your monthly budget.",
                notification_type="budget_80"
            )

    elif percentage_used >= 90:
        already_notified = Notification.objects.filter(
            user=owner,
            title="Critical",
            created_at__year=now.year,
            created_at__month=now.month
        ).exists()

        if not already_notified:
            Notification.objects.create(
                user=owner,
                title="Critical",
                message=f"You have used {int(percentage_used)}% of your monthly budget.",
                notification_type="budget_90"
            )