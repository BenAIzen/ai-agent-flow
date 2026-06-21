"""채권채무집계.

docx (3.매장판매^J수금^J단가등록_지수.docx) 참조:
  "전기(월)이월 = 전미수액 / 당기발생 = 당기거래총액
   당기수금 = 입금액 / 잔액 = 미수액"

GET /api/ledger/receivable?from=YYYY-MM-DD&to=YYYY-MM-DD
    채권(매출처): 거래처별로 (이월 + 매출 - 수금 = 잔액)

GET /api/ledger/payable?from=YYYY-MM-DD&to=YYYY-MM-DD
    채무(매입처): 거래처별로 (이월 + 매입 - 지급 = 잔액)
    매입 데이터가 아직 없으면 0으로.
"""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.collections.models import Collection
from apps.companies.mixins import get_request_company
from apps.delivery.models import DeliveryOrder
from apps.partners.models import Partner
from apps.payments.models import Payment


_ZERO = Decimal("0")


def _to_decimal(v) -> Decimal:
    return Decimal(v) if v is not None else _ZERO


class ReceivableView(APIView):
    """채권 집계 (매출처 대상)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_request_company(request)
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        if not date_from or not date_to:
            return Response({"detail": "from, to required"}, status=400)

        partners = (Partner.objects
                    .filter(company=company, is_active=True,
                            biz_class__in=["customer", "both"]))

        # 전기이월: from 이전까지의 (출고 - 수금)
        bf_sold = dict(DeliveryOrder.objects
                       .filter(company=company,
                               order_date__lt=date_from, status="confirmed")
                       .values_list("partner_id")
                       .annotate(s=Sum("total"))
                       .values_list("partner_id", "s"))
        bf_paid = dict(Collection.objects
                       .filter(company=company, receipt_date__lt=date_from)
                       .values_list("partner_id")
                       .annotate(s=Sum("amount"))
                       .values_list("partner_id", "s"))

        # 당기발생: from~to 출고
        cur_sold = dict(DeliveryOrder.objects
                        .filter(company=company,
                                order_date__gte=date_from, order_date__lte=date_to,
                                status="confirmed")
                        .values_list("partner_id")
                        .annotate(s=Sum("total"))
                        .values_list("partner_id", "s"))

        # 당기수금: from~to 수금
        cur_paid = dict(Collection.objects
                        .filter(company=company,
                                receipt_date__gte=date_from, receipt_date__lte=date_to)
                        .values_list("partner_id")
                        .annotate(s=Sum("amount"))
                        .values_list("partner_id", "s"))

        rows = []
        for p in partners:
            opening = _to_decimal(bf_sold.get(p.id)) - _to_decimal(bf_paid.get(p.id))
            sales = _to_decimal(cur_sold.get(p.id))
            paid = _to_decimal(cur_paid.get(p.id))
            balance = opening + sales - paid
            if opening or sales or paid:
                rows.append({
                    "partner_id": p.id,
                    "partner_code": p.code,
                    "partner_name": p.name,
                    "opening": opening,
                    "sales": sales,
                    "received": paid,
                    "balance": balance,
                })

        rows.sort(key=lambda r: -r["balance"])
        totals = {
            "opening": sum((r["opening"] for r in rows), _ZERO),
            "sales": sum((r["sales"] for r in rows), _ZERO),
            "received": sum((r["received"] for r in rows), _ZERO),
            "balance": sum((r["balance"] for r in rows), _ZERO),
        }
        return Response({"rows": rows, "totals": totals,
                         "from": date_from, "to": date_to})


class PayableView(APIView):
    """채무 집계 (매입처 대상).

    매입 데이터(매입 전표)가 아직 모델에 없어서 발생액은 0으로 두고
    지급/이월만 계산. 추후 매입 전표 추가 시 발생액 보강.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_request_company(request)
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        if not date_from or not date_to:
            return Response({"detail": "from, to required"}, status=400)

        partners = (Partner.objects
                    .filter(company=company, is_active=True,
                            biz_class__in=["vendor", "both"]))

        bf_paid = dict(Payment.objects
                       .filter(company=company, payment_date__lt=date_from)
                       .values_list("partner_id")
                       .annotate(s=Sum("amount"))
                       .values_list("partner_id", "s"))

        cur_paid = dict(Payment.objects
                        .filter(company=company,
                                payment_date__gte=date_from, payment_date__lte=date_to)
                        .values_list("partner_id")
                        .annotate(s=Sum("amount"))
                        .values_list("partner_id", "s"))

        rows = []
        for p in partners:
            opening = -_to_decimal(bf_paid.get(p.id))  # 매입 0 가정 → -지급
            purchases = _ZERO  # 매입 전표 추가되면 여기 보강
            paid = _to_decimal(cur_paid.get(p.id))
            balance = opening + purchases - paid
            if opening or purchases or paid:
                rows.append({
                    "partner_id": p.id,
                    "partner_code": p.code,
                    "partner_name": p.name,
                    "opening": opening,
                    "purchases": purchases,
                    "paid": paid,
                    "balance": balance,
                })
        rows.sort(key=lambda r: r["balance"])
        totals = {
            "opening": sum((r["opening"] for r in rows), _ZERO),
            "purchases": sum((r["purchases"] for r in rows), _ZERO),
            "paid": sum((r["paid"] for r in rows), _ZERO),
            "balance": sum((r["balance"] for r in rows), _ZERO),
        }
        return Response({"rows": rows, "totals": totals,
                         "from": date_from, "to": date_to})
