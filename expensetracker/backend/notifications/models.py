from django.db import models
from django.conf import settings

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ("invite", "Invite"),
        ("login_reminder", "Login Reminder"),
        ("budget_exceeded", "Budget Exceeded"),
        ("insight", "Insight"),
        ("reminder", "General Reminder"),
        ("budget_expiring", "Budget Expiring"),
        ("new_month", "New Month"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="notifications"
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default="reminder")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.title}"