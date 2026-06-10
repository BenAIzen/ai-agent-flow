from rest_framework import serializers

from .models import Item


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = (
            "id", "code", "name", "spec",
            "procure_type", "account_type",
            "unit_in", "unit_out", "unit_stock",
            "standard_cost", "invoice_print_name", "memo",
            "is_active",
        )
        read_only_fields = ("id",)
