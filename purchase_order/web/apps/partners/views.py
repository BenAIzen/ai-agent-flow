from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.companies.codes import next_company_code, normalize_name
from apps.companies.mixins import CompanyScopedMixin, SoftDeleteMixin, get_request_company

from .models import Partner, PartnerAccount  # noqa: F401  (Partner used by next_partner_code wrapper)
from .serializers import PartnerAccountSerializer, PartnerSerializer


# 다른 앱에서 임포트하는 호환 이름. 새 코드는 codes.* 직접 사용 권장.
def next_partner_code(company_id: int) -> str:
    return next_company_code(Partner, company_id)


def normalize_partner_name(name: str) -> str:
    return normalize_name(name)


class PartnerViewSet(SoftDeleteMixin, CompanyScopedMixin, viewsets.ModelViewSet):
    """거래처 CRUD. X-Company-Id 헤더로 자동 스코프."""

    serializer_class = PartnerSerializer
    queryset = Partner.objects.prefetch_related("accounts").all()

    def get_queryset(self):
        qs = super().get_queryset()
        # 검색/필터는 list에만 적용. detail (retrieve/update/destroy)은
        # 비활성 거래처도 대상에 포함시켜야 복원·수정이 가능.
        if self.action != "list":
            return qs

        q = self.request.query_params.get("q")
        biz_class = self.request.query_params.get("biz_class")
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q)
                           | Q(biz_no__icontains=q) | Q(rep_name__icontains=q))
        if biz_class:
            qs = qs.filter(biz_class=biz_class)
        active = self.request.query_params.get("active", "1")
        if active in ("1", "true"):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        """생성 시 거래처 코드 자동 채번 (클라이언트가 보낸 code는 무시)."""
        company = get_request_company(self.request)
        serializer.save(company=company, code=next_partner_code(company.id))

    # DELETE → SoftDeleteMixin이 is_active=False 토글로 처리.

    @action(detail=True, methods=["get", "post"])
    def accounts(self, request, pk=None):
        """GET: 거래처의 계좌 목록 / POST: 새 계좌 추가."""
        partner = self.get_object()
        if request.method == "GET":
            data = PartnerAccountSerializer(partner.accounts.all(), many=True).data
            return Response(data)
        s = PartnerAccountSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(partner=partner)
        return Response(s.data, status=201)
