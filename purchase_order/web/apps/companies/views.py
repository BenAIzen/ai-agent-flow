from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.accounts.models import UserCompany

from .models import Company
from .serializers import CompanySerializer


class CompanyViewSet(viewsets.ModelViewSet):
    """회사 CRUD.

    필터: ?q=<search> — name / biz_no / rep_name 부분 일치.
    DELETE는 soft-delete (is_active=False).
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

    def destroy(self, request, *args, **kwargs):
        c = self.get_object()
        c.is_active = False
        c.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
