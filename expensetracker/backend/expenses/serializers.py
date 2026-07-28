from datetime import date
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Category, Expense, RecurringExpense, SplitGroup, 
    GroupMember, GroupExpense, ExpenseSplit, GroupSettlement, GroupInvite
)

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Expense
        fields = ["id", "title", "amount", "category", "category_name", "date", "payment_method", "description", "receipt", "favorite",'is_tracked_in_insights','is_recurring', "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
        
    def validate_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("Future date is not allowed.")
        return value

class RecurringExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringExpense
        fields = "__all__"
        read_only_fields = ["owner"]

class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]

class ExpenseSplitSerializer(serializers.ModelSerializer):
    user_detail = UserBasicSerializer(source="user", read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ["id", "user", "user_detail", "amount_owed"]

class GroupExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    paid_by_detail = UserBasicSerializer(source="paid_by", read_only=True)
    paid_by_username = serializers.CharField(source="paid_by.username", read_only=True)

    class Meta:
        model = GroupExpense
        fields = ["id", "group", "title", "total_amount", "paid_by", "paid_by_detail", "paid_by_username", "split_type", "date", "description", "splits"]

class GroupMemberSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ["id", "user", "joined_at"]

class SplitGroupSerializer(serializers.ModelSerializer):
    members = GroupMemberSerializer(source="groupmember_set", many=True, read_only=True)
    created_by_detail = UserBasicSerializer(source="created_by", read_only=True)
    expenses = GroupExpenseSerializer(source="groupexpense_set", many=True, read_only=True) # 👈 FIXED: Included expenses array

    class Meta:
        model = SplitGroup
        fields = ["id", "name", "group_type", "created_by", "created_by_detail", "members", "expenses", "created_at"]
        read_only_fields = ["created_by"]

class SettlementSerializer(serializers.ModelSerializer):
    payer_detail = UserBasicSerializer(source="payer", read_only=True)
    payee_detail = UserBasicSerializer(source="payee", read_only=True)

    class Meta:
        model = GroupSettlement
        fields = ["id", "group", "payer", "payer_detail", "payee", "payee_detail", "amount", "is_settled", "created_at"]

class GroupInviteSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    sender_detail = UserBasicSerializer(source="sender", read_only=True)
    receiver_detail = UserBasicSerializer(source="receiver", read_only=True)

    class Meta:
        model = GroupInvite
        fields = ["id", "group", "group_name", "sender", "sender_detail", "receiver", "receiver_detail", "status", "created_at"]