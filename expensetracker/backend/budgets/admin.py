from django.contrib import admin
from .models import *
# Register your models here.
@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("id","owner","monthly_budget","month","year",)
    list_filter = ("month","year",)
    search_fields = ("owner__username",)
    readonly_fields = ("created_at","updated_at",)
