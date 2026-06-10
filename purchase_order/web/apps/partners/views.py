from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.companies.mixins import CompanyScopedMixin, get_request_company

from .models import Partner, PartnerAccount
from .serializers import PartnerAccountSerializer, PartnerSerializer


class PartnerViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    """거래처 CRUD. X-Company-Id 헤더로 자동 스코프."""

    serializer_class = PartnerSerializer
    queryset = Partner.objects.prefetch_related("accounts").all()

    def get_queryset(self):
        qs = super().get_queryset()
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
