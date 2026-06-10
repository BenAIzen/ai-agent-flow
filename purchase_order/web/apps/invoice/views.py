"""거래명세서 API.

GET  /api/invoice/setting           — 현재 사용자/회사의 16개 옵션 조회
PUT  /api/invoice/setting           — 옵션 저장
GET  /api/invoice/preview?partner&date  — 명세서 데이터(JSON, 미리보기)
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.mixins import get_request_company
from apps.partners.models import Partner

from .models import InvoiceSetting
from .serializers import InvoiceSettingSerializer
from .services import build_invoice_data


class InvoiceSettingView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_or_create(self, request):
        company = get_request_company(request)
        obj, _ = InvoiceSetting.objects.get_or_create(
            user=request.user, company=company,
        )
        return obj

    def get(self, request):
        return Response(InvoiceSettingSerializer(self._get_or_create(request)).data)

    def put(self, request):
        obj = self._get_or_create(request)
        s = InvoiceSettingSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class InvoicePreviewView(APIView):
    """명세서 데이터 조립. 프론트가 이 JSON으로 HTML을 그림 → window.print()."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_request_company(request)
        try:
            partner = Partner.objects.get(
                pk=request.query_params.get("partner"), company=company,
            )
        except Partner.DoesNotExist:
            return Response({"detail": "partner not found"}, status=404)
        ymd = request.query_params.get("date")
        if not ymd:
            return Response({"detail": "date required"}, status=400)

        data = build_invoice_data(company, partner, ymd)
        return Response(data)
