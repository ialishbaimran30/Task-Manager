from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from dateutil.relativedelta import relativedelta
from datetime import date
from django.utils import timezone
# Create your models here.

class PaymentMethod(models.TextChoices):
    CASH = "Cash", "Cash"
    CREDIT_CARD = "Credit Card", "Credit Card"
    DEBIT_CARD = "Debit Card", "Debit Card"
    BANK_TRANSFER = "Bank Transfer", "Bank Transfer"
    JAZZCASH = "JazzCash", "JazzCash"
    EASYPAISA = "Easypaisa", "Easypaisa"
    OTHER = "Other", "Other"

class Category(models.Model):

    name = models.CharField(max_length=100)
    owner = models.ForeignKey(User,on_delete=models.CASCADE,related_name="categories",null=True,blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ["name"]
        unique_together=("owner","name")

    def __str__(self):
        return self.name
    
class Expense(models.Model):
    owner = models.ForeignKey(User,on_delete=models.CASCADE,related_name="expenses")
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10,decimal_places=2,validators=[MinValueValidator(1)])
    category = models.ForeignKey(Category,on_delete=models.SET_NULL,null=True,related_name="expenses")
    date = models.DateField()
    payment_method = models.CharField(max_length=30,choices=PaymentMethod.choices,default=PaymentMethod.CASH)
    description = models.TextField(blank=True)
    receipt = models.ImageField(upload_to="receipts/",blank=True,null=True)
    favorite = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_recurring = models.BooleanField(default=False)
    is_tracked_in_insights = models.BooleanField(default=False)

    recurrence_type = models.CharField(
        max_length=20,
        choices=[
            ("monthly", "Monthly"),
            ("weekly", "Weekly"),
            ("yearly", "Yearly"),
        ],
        blank=True,
        null=True,
    )
    next_due_date = models.DateField(
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["owner"]),models.Index(fields=["date"]),models.Index(fields=["category"]), models.Index(fields=["favorite"]),]

    def __str__(self):
        return f"{self.title} - {self.amount}"

from django.db import models
from django.conf import settings
from dateutil.relativedelta import relativedelta

class RecurringExpense(models.Model):
    class Frequency(models.TextChoices):
        DAILY = 'DAILY', 'Daily'
        WEEKLY = 'WEEKLY', 'Weekly'
        MONTHLY = 'MONTHLY', 'Monthly'
        YEARLY = 'YEARLY', 'Yearly'

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.ForeignKey('Category', on_delete=models.SET_NULL, null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.MONTHLY)
    start_date = models.DateField()
    next_due = models.DateField()
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    def calculate_next_due_date(self):
        
        if self.frequency == self.Frequency.DAILY:
            return self.next_due + relativedelta(days=1)
        elif self.frequency == self.Frequency.WEEKLY:
            return self.next_due + relativedelta(weeks=1)
        elif self.frequency == self.Frequency.MONTHLY:
            return self.next_due + relativedelta(months=1)
        elif self.frequency == self.Frequency.YEARLY:
            return self.next_due + relativedelta(years=1)
        return self.next_due


class SplitGroup(models.Model):
    class GroupType(models.TextChoices):
        TRIP = "Trip", "Trip"
        HOME = "Home", "Home / Flatmates"
        PAIR = "Couple", "Couple / Pair"
        EVENT = "Event", "Event"
        OTHER = "Other", "Other"

    name = models.CharField(max_length=150)
    group_type = models.CharField(max_length=20, choices=GroupType.choices, default=GroupType.OTHER)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_groups")
    members = models.ManyToManyField(User, through="GroupMember", related_name="split_groups")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class GroupMember(models.Model):
    group = models.ForeignKey(SplitGroup, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")

class GroupExpense(models.Model):
    class SplitType(models.TextChoices):
        EQUAL = "EQUAL", "Equal"
        SELECTED = "SELECTED", "Selected Members"
        EXACT = "EXACT", "Exact Amounts"
        PERCENT = "PERCENT", "Percentage"

    group = models.ForeignKey(SplitGroup, on_delete=models.CASCADE, related_name="expenses")
    title = models.CharField(max_length=255)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(1)])
    paid_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="paid_group_expenses")
    split_type = models.CharField(max_length=10, choices=SplitType.choices, default=SplitType.EQUAL)
    date = models.DateField(default=date.today)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.title} - {self.total_amount}"

class ExpenseSplit(models.Model):
    expense = models.ForeignKey(GroupExpense, on_delete=models.CASCADE, related_name="splits")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="expense_shares")
    amount_owed = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ("expense", "user")

class GroupSettlement(models.Model):
    group = models.ForeignKey(SplitGroup, on_delete=models.CASCADE, related_name="settlements")
    payer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="settlements_paid")
    payee = models.ForeignKey(User, on_delete=models.CASCADE, related_name="settlements_received")
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(1)])
    is_settled = models.BooleanField(default=True) # Direct settle logic
    created_at = models.DateTimeField(auto_now_add=True)

class GroupInvite(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"

    group = models.ForeignKey(SplitGroup, on_delete=models.CASCADE, related_name="invites")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_invites")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_invites")
    status = models.CharField(max_length=10, choices=StatusChoices.choices, default=StatusChoices.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "receiver")

    def __str__(self):
        return f"Invite to {self.receiver.username} for {self.group.name} [{self.status}]"