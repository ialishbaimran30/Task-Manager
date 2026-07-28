import os
from django.apps import AppConfig

class ExpensesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'expenses'

    def ready(self):
        # 1. Signals import karein (Important for budget & real notifications)
        import expenses.signals

        # 2. Scheduler logic (Development double execution protection)
        if os.environ.get('RUN_MAIN') == 'true' or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            from apscheduler.schedulers.background import BackgroundScheduler
            from django.core.management import call_command

            def run_recurring():
                try:
                    call_command('process_recurring_expenses')
                except Exception as e:
                    print(f"Scheduler Error: {e}")

            scheduler = BackgroundScheduler()
            
            # FIX: Har 10 seconds nahi, ab har 24 ghante (1 din) baad chalega
            scheduler.add_job(run_recurring, 'interval', hours=24)
            
            scheduler.start()