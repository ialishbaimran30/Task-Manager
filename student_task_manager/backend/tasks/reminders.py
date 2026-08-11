import logging
from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone

from .models import Task
from .utils import push_notification

logger = logging.getLogger(__name__)

# Ordered from farthest to nearest deadline. When a task's remaining time
# first drops at or below a threshold, that tier's reminder fires once.
REMINDER_TIERS = [
    (timedelta(hours=2), "reminder_2h_sent"),
    (timedelta(hours=1), "reminder_1h_sent"),
    (timedelta(minutes=45), "reminder_45m_sent"),
    (timedelta(minutes=30), "reminder_30m_sent"),
    (timedelta(minutes=15), "reminder_15m_sent"),
]
REMINDER_FIELDS = [field for _, field in REMINDER_TIERS]


def _deadline_for(task):
    naive = datetime.combine(task.due_date, task.due_time or time.min)
    return timezone.make_aware(naive) if timezone.is_naive(naive) else naive


def _remaining_text(remaining):
    total_minutes = max(int(remaining.total_seconds() // 60), 1)
    if total_minutes >= 60:
        hours = round(total_minutes / 60)
        return f"{hours} hour" if hours == 1 else f"{hours} hours"
    return f"{total_minutes} minute" if total_minutes == 1 else f"{total_minutes} minutes"


def send_deadline_reminders():
    """Push a WS notification to a task's assignee as its deadline approaches.

    Runs on a periodic scheduler (see scheduler.py) rather than relying on the
    frontend, so reminders still fire while the assignee's browser is closed.
    """
    now = timezone.localtime()
    pending_filter = Q(deadline_notified=False)
    for field in REMINDER_FIELDS:
        pending_filter |= Q(**{field: False})

    candidates = Task.objects.filter(
        status__in=["Pending", "In Progress"],
        due_date__isnull=False,
    ).filter(pending_filter)

    sent = 0
    for task in candidates:
        remaining = _deadline_for(task) - now

        if remaining <= timedelta(0):
            if not task.deadline_notified:
                push_notification(task.user, f"Your task '{task.title}' is overdue.", task=task)
                # Mark every reminder tier as sent too, so a task that went
                # overdue before any of them fired can never trigger them
                # after the fact - only the overdue notice makes sense now.
                Task.objects.filter(pk=task.pk).update(
                    deadline_notified=True, **{field: True for field in REMINDER_FIELDS}
                )
                sent += 1
            continue

        # Find the tightest tier the remaining time currently falls under
        # (smallest threshold that's still >= remaining) - e.g. 50 minutes
        # left must match the 1-hour tier, not the 2-hour one.
        current = min(
            (t for t in REMINDER_TIERS if remaining <= t[0]),
            key=lambda t: t[0],
            default=None,
        )
        if current is None or getattr(task, current[1]):
            continue

        threshold, _ = current
        # Mark this tier and every farther-out tier as sent, so a scheduler
        # poll that skips straight past an earlier tier (e.g. task created
        # with less than an hour left) never fires it after the fact.
        fields = {f: True for t, f in REMINDER_TIERS if t >= threshold}

        push_notification(
            task.user,
            f"Reminder: You have {_remaining_text(remaining)} left for your task '{task.title}'.",
            task=task,
        )
        # queryset.update() bypasses Task.save(), which resets these same
        # flags when due_date/due_time change - not applicable here.
        Task.objects.filter(pk=task.pk).update(**fields)
        sent += 1

    if sent:
        logger.info("Sent %s deadline reminder(s)", sent)
    return sent
