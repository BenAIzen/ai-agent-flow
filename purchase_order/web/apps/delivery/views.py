from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.companies.mixins import CompanyScopedMixin, get_request_company
from apps.prices.models import lookup_sale_price

from .models import DeliveryOrder
from .serializers import DeliveryOrderSerializer


class DeliveryOrderViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    serializer_class = DeliveryOrderSerializer
    queryset = (
        DeliveryOrder.objects
        .select_related("partner")
        .prefetch_related("lines", "lines__item")
        .all()
    )

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        partner = self.request.query_params.get("partner")
        q = self.request.query_params.get("q")
        if date_from:
            qs = qs.filter(order_date__gte=date_from)
        if date_to:
            qs = qs.filter(order_date__lte=date_to)
        if partner:
            qs = qs.filter(partner_id=partner)
        if q:
            qs = qs.filter(Q(order_no__icontains=q) | Q(partner__name__icontains=q)
                           | Q(note__icontains=q))
        return qs

    @action(detail=False, methods=["get"], url_path="suggest-price")
    def suggest_price(self, request):
        """출고처리 UI에서 거래처/품목 선택 시 단가 자동조회."""
        # 회사 컨텍스트 검증만 수행 (X-Company-Id 누락 시 403).
        get_request_company(request)
        try:
            partner_id = int(request.query_params.get("partner"))
            item_id = int(request.query_params.get("item"))
        except (TypeError, ValueError):
            return Response({"detail": "partner, item required"}, status=400)
        ymd = request.query_params.get("date")
        if not ymd:
            return Response({"detail": "date required"}, status=400)

        p = lookup_sale_price(partner_id, item_id, ymd)
        if p:
            return Response({
                "unit_price": p.sale_price,
                "source": "partner_price",
                "effective_from": p.effective_from,
            })

        # PartnerPrice 미등록 → 사용자가 수동 입력하도록 0 반환.
        # (표준원가 폴백 제거: 그린푸드는 거래처별 단가만 사용)
        return Response({"unit_price": 0, "source": "none"})
