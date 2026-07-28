from rest_framework import serializers
from .models import Budget
# from rest_framework.validators import UniqueTogetherValidator
class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ["id","monthly_budget","month","year","created_at","updated_at",]
        read_only_fields = ["id","created_at","updated_at",]
        
    def validate(self, attrs):
        request = self.context["request"]

        exists = Budget.objects.filter(
            owner=request.user,
            month=attrs["month"],
            year=attrs["year"],
        )

        if self.instance:
            exists = exists.exclude(pk=self.instance.pk)

        if exists.exists():
            raise serializers.ValidationError("Budget already exists for this month."
            )

        return attrs
    def validate_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("Month must be between 1 and 12.")
        return value
    def validate_monthly_budget(self, value):
        if value <= 0:
            raise serializers.ValidationError("Budget must be greater than zero.")
        return value

    def validate_year(self, value):

        if value < 2025:
            raise serializers.ValidationError("Invalid year.")
        return value
print("Budget model loaded succesfully")