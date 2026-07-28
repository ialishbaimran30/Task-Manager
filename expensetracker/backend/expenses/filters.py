import django_filters
from .models import Expense
class ExpenseFilter(django_filters.FilterSet):
    date = django_filters.DateFilter()
    category = django_filters.NumberFilter()
    favorite = django_filters.BooleanFilter()
    payment_method = django_filters.CharFilter()
    class Meta:
        model = Expense
        fields = ["category","date","favorite","payment_method",]