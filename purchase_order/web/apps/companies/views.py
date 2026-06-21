from django.db.models import Q
from rest_framework import viewsets

from apps.accounts.models import UserCompany

from .mixins import SoftDeleteMixin
from .models import Company
from .serializers import CompanySerializer


class CompanyViewSet(SoftDeleteMixin, viewsets.ModelViewSet):
    """회사 CRUD.

    필터: ?q=<search> — name / biz_no / rep_name 부분 일치.
    DELETE는 soft-delete (is_active=False) — SoftDeleteMixin 적용.
    """

    serializer_class = CompanySerializer

    def get_queryset(self):
        qs = Company.objects.filter(is_active=True)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(biz_no__icontains=q)
                           | Q(rep_name__icontains=q))
        return qs.order_by("-is_default", "name")

    def perform_create(self, serializer):
        company = serializer.save()
        # 생성자에게 admin 멤버십 자동 부여
        UserCompany.objects.get_or_create(
            user=self.request.user, company=company,
            defaults={"role": "admin"},
        )
