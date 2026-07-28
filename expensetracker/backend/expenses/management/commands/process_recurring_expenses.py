from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from expenses.models import RecurringExpense, Expense
from datetime import date
class Command(BaseCommand):
    help = "Processes due recurring expenses and creates actual expense entries."
    def handle(self, *args, **options):
        today = date.today()
        
        due_recurring = RecurringExpense.objects.filter(
            active=True,
            next_due__lte=today
        )

        
        self.stdout.write(f"--- [CHECKING RECURRING] Found {due_recurring.count()} due item(s) for date {today} ---")

        created_count = 0

        for recurring in due_recurring:
            with transaction.atomic():
                already_exists = Expense.objects.filter(
                    owner=recurring.owner,
                    title=recurring.title,
                    amount=recurring.amount,
                    date=recurring.next_due
                ).exists()

                if not already_exists:
                    Expense.objects.create(
                        owner=recurring.owner,
                        title=recurring.title,
                        amount=recurring.amount,
                        category=recurring.category,
                        date=recurring.next_due,
                        payment_method=recurring.payment_method,
                        description=f"[Auto-Generated] {recurring.description or ''}".strip()
                    )
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f"✅ Generated expense: {recurring.title}"))

                # Date advance update
                recurring.next_due = recurring.calculate_next_due_date()
                recurring.save()

        # 🔍 Always Print Summary: Ab 'Created: 0' bhi print hoga agar koi item nahi mila
        self.stdout.write(
            self.style.SUCCESS(f"Successfully processed recurring expenses. Created: {created_count}")
        )