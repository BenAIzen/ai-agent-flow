from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    partner_code = serializers.CharField(source="partner.code", read_only=True)
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    payment_type_label = serializers.CharField(
        source="get_payment_type_display", read_only=True
    )

    class Meta:
        model = Payment
        fields = (
            "id", "payment_no", "payment_date",
            "partner", "partner_code", "partner_name",
            "payment_type", "payment_type_label",
            "amount", "bank_account", "note",
        )
        read_only_fields = ("id", "payment_no")

    def create(self, validated_data):
        from apps.companies.mixins import get_request_company
        company = get_request_company(self.context["request"])
        validated_data["company"] = company
        validated_data["payment_no"] = Payment.generate_payment_no(
            company.id, validated_data["payment_date"]
        )
        return super().create(validated_data)
