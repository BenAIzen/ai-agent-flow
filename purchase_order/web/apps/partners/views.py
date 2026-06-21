from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.companies.mixins import CompanyScopedMixin, get_request_company

from .models import Partner, PartnerAccount
from .serializers import PartnerAccountSerializer, PartnerSerializer


def next_partner_code(company_id: int) -> str:
    """회사 내에서 다음 거래처 코드(3자리 0패딩) 채번.

    숫자형 코드(예: 001~106) 중 최대값 + 1. 숫자가 아닌 코드(legacy)는 무시.
    1000건 넘어가면 자연스럽게 4자리로 늘어남.
    """
    rows = Partner.objects.filter(company_id=company_id).values_list("code", flat=True)
    max_n = 0
    for c in rows:
        if c and c.isdigit():
            n = int(c)
            if n > max_n:
                max_n = n
    return f"{max_n + 1:03d}"


def normalize_partner_name(name: str) -> str:
    """거래처 이름 매칭용 정규화. 품목과 동일 규칙."""
    return " ".join((name or "").split())




class PartnerViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
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

    def destroy(self, request, *args, **kwargs):
        """Soft delete: is_active=False만 토글. 과거 전표/명세서 보존을 위해 행은 유지.

        다시 활성화하려면 PATCH로 is_active=true 보내면 됨.
        """
        partner = self.get_object()
        partner.is_active = False
        partner.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

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
