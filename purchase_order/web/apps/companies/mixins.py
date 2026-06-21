"""Multi-tenancy helpers.

요청 헤더 X-Company-Id로 회사를 식별하고 모든 queryset/생성에 자동 적용.
"""

from __future__ import annotations

from rest_framework.exceptions import NotFound, PermissionDenied

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
