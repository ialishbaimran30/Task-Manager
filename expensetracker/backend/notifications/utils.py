from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Notification

def send_live_notification(user, title, message, notification_type="reminder"):
    # 1. DB me create karein
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type
    )

    # 2. Live WebSocket broadcast
    channel_layer = get_channel_layer()
    payload = {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "notification_type": notification.notification_type,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }

    async_to_sync(channel_layer.group_send)(
        f"user_{user.id}",
        {
            "type": "send_notification",
            "notification": payload
        }
    )
    return notification