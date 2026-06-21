from rest_framework import serializers

from .models import Partner, PartnerAccount


class PartnerAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerAccount
        fields = ("id", "bank", "account_no", "holder", "nickname",
                  "is_default", "is_active")


class PartnerSerializer(serializers.ModelSerializer):
    accounts = PartnerAccountSerializer(many=True, read_only=True)

    class Meta:
        model = Partner
        fields = (
            "id", "code", "name", "biz_class",
            "biz_no", "rep_name", "biz_kind", "biz_item",
            "address", "tel", "fax", "email",
            "vat_type", "output_name", "memo",
            "is_active", "accounts",
        )
        read_only_fields = ("id", "code")  # code는 서버 자동 채번
        extra_kwargs = {"code": {"required": False}}
