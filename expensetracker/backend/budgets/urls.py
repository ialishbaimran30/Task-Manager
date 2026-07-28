from django.urls import path
from .views import (BudgetListCreateView,BudgetDetailView,BudgetSummaryView,BudgetMeView,)
urlpatterns = [
    path("budgets/", BudgetListCreateView.as_view(), name="budget-list"),
    path("budgets/<int:pk>/", BudgetDetailView.as_view(), name="budget-detail"),
    path("budgets/<int:pk>/summary/", BudgetSummaryView.as_view(), name="budget-summary"),
    path("budgets/me/", BudgetMeView.as_view(), name="budget-me"),
]