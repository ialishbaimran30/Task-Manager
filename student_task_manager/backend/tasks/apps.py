import os
import sys

from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        # Only start the deadline-reminder scheduler for the actual dev
        # server process (not for migrate/makemigrations/shell/tests, and
        # not twice in the autoreloader's parent process).
        if 'runserver' not in sys.argv or os.environ.get('RUN_MAIN') != 'true':
            return
        from . import scheduler
        scheduler.start()
