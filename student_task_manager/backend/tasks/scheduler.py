import logging

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

_scheduler = None


def start():
    """Start the in-process background job that checks task deadlines.

    Idempotent: safe to call more than once (e.g. Django's autoreloader).
    """
    global _scheduler
    if _scheduler is not None:
        return

    from .reminders import send_deadline_reminders

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        send_deadline_reminders,
        "interval",
        minutes=5,
        id="deadline_reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info("Deadline reminder scheduler started")
