from rest_framework import serializers

from .models import Collection


class CollectionSerializer(serializers.ModelSerializer):
    partner_code = serializers.CharField(source="partner.code", read_only=True)
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    receipt_type_label = serializers.CharField(
        source="get_receipt_type_display", read_only=True
    )

    class Meta:
        model = Collection
        fields = (
            "id", "receipt_no", "receipt_date",
            "partner", "partner_code", "partner_name",
            "receipt_type", "receipt_type_label",
            "amount", "bank_account", "note",
        )
        read_only_fields = ("id", "receipt_no")

    def create(self, validated_data):
        from apps.companies.mixins import get_request_company
        company = get_request_company(self.context["request"])
        validated_data["company"] = company
        validated_data["receipt_no"] = Collection.generate_receipt_no(
            company.id, validated_data["receipt_date"]
        )
        return super().create(validated_data)
