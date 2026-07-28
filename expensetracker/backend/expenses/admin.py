from django.contrib import admin
from .models import Category,Expense
# Register your models here.



@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id","name","owner","owner",)
    list_filter = ("owner",)
    search_fields = ("name",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("id","title","amount","category","owner","payment_method","favorite","date",)
    list_filter = ("favorite","payment_method","category","date",)
    search_fields = ("title","description",)
    readonly_fields = ("created_at","updated_at",)
    ordering = ("-created_at",)
    list_per_page = 20