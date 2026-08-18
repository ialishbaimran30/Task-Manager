import os
import sys

from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        # Start the deadline-reminder scheduler for anything that actually
        # serves requests: `runserver` locally, or the production ASGI
        # server (daphne) in the container. Skip one-off management
        # commands (migrate/makemigrations/shell/tests/collectstatic/etc.),
        # and avoid starting it twice in runserver's autoreloader parent.
        command = sys.argv[1] if len(sys.argv) > 1 else ""
        non_serving_commands = {
            'migrate', 'makemigrations', 'shell', 'test', 'collectstatic',
            'createsuperuser', 'check', 'dbshell', 'showmigrations',
        }
        if command in non_serving_commands:
            return
        if command == 'runserver' and os.environ.get('RUN_MAIN') != 'true':
            return
        from . import scheduler
        scheduler.start()
