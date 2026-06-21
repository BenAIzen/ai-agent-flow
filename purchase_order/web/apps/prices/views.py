from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from apps.companies.mixins import get_request_company

from .models import PartnerPrice
from .serializers import PartnerPriceSerializer


class PartnerPriceViewSet(viewsets.ModelViewSet):
    """거래처별 단가.

    PartnerPrice 자체엔 company FK가 없지만 partner를 통해 회사 스코프됩니다.
    필터:
      ?partner=<id>  거래처 1개의 단가만
      ?item=<id>     품목 1개의 거래처별 단가
      ?q=<keyword>   품명/품목코드 부분일치
    """

    serializer_class = PartnerPriceSerializer
    queryset = PartnerPrice.objects.select_related("partner", "item").all()

    def get_queryset(self):
        company = get_request_company(self.request)
        qs = super().get_queryset().filter(partner__company=company)
        p = self.request.query_params.get("partner")
        i = self.request.query_params.get("item")
        q = self.request.query_params.get("q")
        if p:
            qs = qs.filter(partner_id=p)
        if i:
            qs = qs.filter(item_id=i)
        if q:
            qs = qs.filter(item__name__icontains=q) | qs.filter(item__code__icontains=q)
        if self.request.query_params.get("active", "1") in ("1", "true"):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        company = get_request_company(self.request)
        partner = serializer.validated_data["partner"]
        item = serializer.validated_data["item"]
        if partner.company_id != company.id or item.company_id != company.id:
            raise ValidationError(
                "partner/item 이 현재 회사 소속이 아닙니다."
            )
        serializer.save()
