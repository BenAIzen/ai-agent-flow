from rest_framework import serializers

from apps.partners.models import Partner

from .models import Item


class ItemSerializer(serializers.ModelSerializer):
    # 응답 편의용 — 거래처 이름/코드를 함께 노출.
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    partner_code = serializers.CharField(source="partner.code", read_only=True)

    class Meta:
        model = Item
        fields = (
            "id", "code", "partner", "partner_name", "partner_code",
            "name", "spec",
            "procure_type", "account_type",
            "unit_in", "unit_out", "unit_stock",
            "standard_cost", "invoice_print_name", "memo",
            "is_active",
        )
        read_only_fields = ("id",)
        # code는 수동 입력이 원칙이지만, 빈 값으로 보내면 서버가 자동 채번
        # (perform_create에서 처리). 폼은 required 유지하고 싶으면 클라이언트에서.
        extra_kwargs = {"code": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        # 신규 생성 시 거래처는 필수. 기존 행 수정 시에는 변경 안 하면 OK.
        if self.instance is None and attrs.get("partner") is None:
            raise serializers.ValidationError({"partner": "거래처를 선택해 주세요."})
        return attrs

    def validate_partner(self, value: Partner | None) -> Partner | None:
        # 다른 회사 거래처 못 쓰게 차단 (멀티테넌시 누출 방지).
        request = self.context.get("request")
        if value is None or request is None:
            return value
        from apps.companies.mixins import get_request_company
        company = get_request_company(request)
        if value.company_id != company.id:
            raise serializers.ValidationError("다른 회사의 거래처는 선택할 수 없습니다.")
        return value
