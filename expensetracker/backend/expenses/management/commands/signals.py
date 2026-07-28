from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Expense

@receiver(post_save, sender=Expense)
def notify_auto_expense_creation(sender, instance, created, **kwargs):
    if created and "[Auto-Generated]" in instance.description:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{instance.owner.id}",
            {
                "type": "send_notification",
                "message": f"Auto-expense recorded: {instance.title} (Rs {instance.amount})"
            }
        )