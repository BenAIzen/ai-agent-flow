from rest_framework import serializers

from .models import Company


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ("id", "name", "biz_no", "rep_name", "biz_type",
                  "is_default", "is_active")
        read_only_fields = ("id",)
