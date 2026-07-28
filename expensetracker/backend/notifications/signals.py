from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Sum
from expenses.models import Expense
from .models import Notification
from .utils import send_live_notification
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

def send_realtime_notification(user, title, message, notification_type):
    # 1. Save Notification in DB
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type
    )

    # 2. Push via WebSocket Group Channel
    channel_layer = get_channel_layer()
    if channel_layer:
        # Consumer group format: user_<user_id>
        group_name = f"user_{user.id}"
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "send_notification",  # Calls send_notification method in Consumer
                "notification": {
                    "id": notification.id,
                    "title": notification.title,
                    "message": notification.message,
                    "notification_type": notification.notification_type,
                    "created_at": str(notification.created_at),
                    "is_read": False,
                }
            }
        )
    return notification

# 1️⃣ LOGIN REMINDER TRIGGER
@receiver(user_logged_in)
def trigger_login_reminder(sender, request, user, **kwargs):
    today = timezone.now().date()
    
    # Check karein ke kya aaj user ko pehle reminder chuka hai?
    already_sent = Notification.objects.filter(
        user=user,
        notification_type="login_reminder",
        created_at__date=today
    ).exists()

    if not already_sent:
        send_live_notification(
            user=user,
            title="Daily Reminder",
            message="Don't forget to add today's expenses!",
            notification_type="login_reminder"
        )


# 2️⃣ REAL BUDGET TRIGGER (Runs ONLY on Expense Save)
@receiver(post_save, sender=Expense)
def trigger_budget_check(sender, instance, created, **kwargs):
    if not created:
        return

    owner = getattr(instance, 'owner', getattr(instance, 'user', None))
    if not owner:
        return

    now = timezone.now()
    monthly_budget = getattr(owner, 'monthly_budget', 0)
    
    if not monthly_budget or monthly_budget <= 0:
        return

    # Total spend of this month
    total_spent = Expense.objects.filter(
        owner=owner,
        date__year=now.year,
        date__month=now.month
    ).aggregate(total=Sum('amount'))['total'] or 0

    percentage = (total_spent / monthly_budget) * 100

    if 80 <= percentage < 90:
        exists = Notification.objects.filter(
            user=owner,
            notification_type="budget_exceeded",
            created_at__year=now.year,
            created_at__month=now.month,
            title__contains="80%"
        ).exists()

        if not exists:
            send_live_notification(
                user=owner,
                title="Budget Warning (80%)",
                message=f"You have used {int(percentage)}% of your monthly budget.",
                notification_type="budget_exceeded"
            )

    elif percentage >= 90:
        exists = Notification.objects.filter(
            user=owner,
            notification_type="budget_exceeded",
            created_at__year=now.year,
            created_at__month=now.month,
            title__contains="90%"
        ).exists()

        if not exists:
            send_live_notification(
                user=owner,
                title="Critical Budget Limit (90%)",
                message=f"You have used {int(percentage)}% of your monthly budget.",
                notification_type="budget_exceeded"
            )

