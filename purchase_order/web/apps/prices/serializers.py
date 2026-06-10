from rest_framework import serializers

from .models import PartnerPrice


class PartnerPriceSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    partner_code = serializers.CharField(source="partner.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_spec = serializers.CharField(source="item.spec", read_only=True)
    item_unit = serializers.CharField(source="item.unit_out", read_only=True)

    class Meta:
        model = PartnerPrice
        fields = (
            "id",
            "partner", "partner_code", "partner_name",
            "item", "item_code", "item_name", "item_spec", "item_unit",
            "sale_price", "purchase_price",
            "effective_from", "memo", "is_active",
        )
        read_only_fields = ("id",)
