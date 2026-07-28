from django.urls import path
from .views import (
    NotificationListView,
    UnreadCountView,
    MarkAllReadView,
)

urlpatterns = [
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/unread-count/', UnreadCountView.as_view(), name='notification-unread-count'),
    path('notifications/mark-all-read/', MarkAllReadView.as_view(), name='notification-mark-all-read'),
]