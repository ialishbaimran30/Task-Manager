from django.urls import path
from .views import (CategoryListCreateView,CategoryDetailView,ExpenseListCreateView,ExpenseDetailView,ExpenseDashboardView,RecurringExpenseListCreateView,RecurringExpenseDetailView,UpcomingRecurringExpenseView,ExpenseInsightsView,SendGroupInviteView, UserPendingInvitesView, RespondGroupInviteView,
SplitGroupListCreateView, AddGroupMemberView, GroupExpenseCreateView, GroupBalancesView, RecordSettlementView,GroupDetailView,LeaveGroupView)

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="category-list"),
    path("categories/<int:pk>/", CategoryDetailView.as_view(), name="category-detail"),

    path("expenses/", ExpenseListCreateView.as_view(), name="expense-list"),
    path("expenses/<int:pk>/", ExpenseDetailView.as_view(), name="expense-detail"),
    path("expenses/dashboard/", ExpenseDashboardView.as_view(), name="expense-dashboard"),
    path("expenses/recurring/", RecurringExpenseListCreateView.as_view(), name="recurring-expense-list"),
    path("expenses/recurring/<int:pk>/", RecurringExpenseDetailView.as_view(), name="recurring-expense-detail"),
    path("recurring-expenses/upcoming/", UpcomingRecurringExpenseView.as_view(), name="upcoming-recurring-expenses"),
    path("expenses/insights/", ExpenseInsightsView.as_view(), name="expense-insights"),
    path('split-groups/', SplitGroupListCreateView.as_view(), name='group-list-create'),
    path('split-groups/<int:group_id>/add-member/', AddGroupMemberView.as_view(), name='group-add-member'),
    path('split-groups/<int:group_id>/send-invite/', SendGroupInviteView.as_view(), name='group-send-invite'),
    path('split-groups/my-invites/', UserPendingInvitesView.as_view(), name='user-invites'),
    path('split-groups/invites/<int:invite_id>/respond/', RespondGroupInviteView.as_view(), name='respond-invite'),
    path('split-groups/<int:group_id>/expenses/', GroupExpenseCreateView.as_view(), name='group-add-expense'),
    path('split-groups/<int:group_id>/balances/', GroupBalancesView.as_view(), name='group-balances'),
    path('split-groups/settle/', RecordSettlementView.as_view(), name='record-settlement'),
    path('split-groups/<int:group_id>/', GroupDetailView.as_view(), name='group-detail'),
    path('split-groups/<int:group_id>/leave/', LeaveGroupView.as_view(), name='leave-group'),
]