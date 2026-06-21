"""Multi-tenancy helpers.

요청 헤더 X-Company-Id로 회사를 식별하고 모든 queryset/생성에 자동 적용.
공통 ViewSet 동작(soft delete, 날짜 범위 필터)을 위한 mixin도 함께 제공.
"""

from __future__ import annotations

from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from .models import Company


def get_request_company(request) -> Company:
    cid = request.headers.get("X-Company-Id")
    if not cid:
        raise PermissionDenied("X-Company-Id header required")
    try:
        return Company.objects.get(pk=cid, is_active=True)
    except Company.DoesNotExist:
        raise NotFound("company not found")


class CompanyScopedMixin:
    """ViewSet에 mix-in. queryset과 create를 회사로 자동 스코프."""

    company_field = "company"

    def get_queryset(self):
        qs = super().get_queryset()
        company = get_request_company(self.request)
        return qs.filter(**{self.company_field: company})

    def perform_create(self, serializer):
        company = get_request_company(self.request)
        serializer.save(**{self.company_field: company})


class SoftDeleteMixin:
    """DELETE를 hard delete 대신 is_active=False 토글로 처리.

    Company / Partner 같이 거래내역 보존이 필요한 모델에 사용. 다시 활성화는
    PATCH로 is_active=True 보내면 됨.
    """

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.is_active = False
        update_fields = ["is_active"]
        if any(f.name == "updated_at" for f in obj._meta.fields):
            update_fields.append("updated_at")
        obj.save(update_fields=update_fields)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DateRangeFilterMixin:
    """`?from=YYYY-MM-DD&to=YYYY-MM-DD&q=...&partner=...` 공용 필터.

    상속하는 ViewSet은 다음 클래스 attribute로 컬럼명을 지정:
      date_field    : 날짜 필터 컬럼 (예: 'receipt_date', 'order_date')
      search_fields : icontains OR 검색 컬럼 리스트 (예: ['receipt_no', 'note'])
      partner_field : 'partner_id' (기본). None이면 partner 필터 미적용.
    """

    date_field: str = ""
    search_fields: list[str] = []
    partner_field: str | None = "partner_id"

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        date_from = params.get("from")
        date_to = params.get("to")
        if self.date_field and date_from:
            qs = qs.filter(**{f"{self.date_field}__gte": date_from})
        if self.date_field and date_to:
            qs = qs.filter(**{f"{self.date_field}__lte": date_to})

        if self.partner_field and (pid := params.get("partner")):
            qs = qs.filter(**{self.partner_field: pid})

        q = params.get("q")
        if q and self.search_fields:
            cond = Q()
            for f in self.search_fields:
                cond |= Q(**{f"{f}__icontains": q})
            # partner.name 같은 join 검색도 흔하니 명시적으로 추가:
            if "partner__name" not in self.search_fields:
                cond |= Q(partner__name__icontains=q)
            qs = qs.filter(cond)

        return qs
