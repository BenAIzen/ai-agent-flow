"""거래명세서 데이터 조립.

명세서에 들어가는 정보:
- 공급자 (회사)
- 공급받는자 (거래처)
- 거래일자, 출고전표 라인들
- 전미수액 = 해당일 이전까지의 (출고 합계 - 수금 합계)
- 당일거래총액 = 해당일의 출고 합계
- 입금액 = 해당일의 수금 합계
- 미수액 = 전미수액 + 당일거래총액 - 입금액
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Sum

from apps.collections.models import Collection
from apps.companies.models import Company
from apps.delivery.models import DeliveryOrder
from apps.partners.models import Partner


def _zero() -> Decimal:
    return Decimal("0")


def compute_outstanding(partner: Partner, before: str) -> Decimal:
    """before(포함하지 않음) 이전까지의 미수액 = 출고 - 수금."""
    sold = (DeliveryOrder.objects
            .filter(partner=partner, order_date__lt=before, status="confirmed")
            .aggregate(s=Sum("total"))["s"]) or _zero()
    paid = (Collection.objects
            .filter(partner=partner, receipt_date__lt=before)
            .aggregate(s=Sum("amount"))["s"]) or _zero()
    return Decimal(sold) - Decimal(paid)


def build_invoice_data(
    company: Company, partner: Partner, ymd: str,
) -> dict[str, Any]:
    """ymd 일자의 거래명세서 데이터.

    여러 출고전표가 같은 날 있으면 한 명세서로 묶임.
    """
    orders = (DeliveryOrder.objects
              .filter(company=company, partner=partner, order_date=ymd,
                      status="confirmed")
              .prefetch_related("lines", "lines__item")
              .order_by("order_no"))

    line_rows: list[dict[str, Any]] = []
    for o in orders:
        for ln in o.lines.all():
            line_rows.append({
                "order_no": o.order_no,
                "item_code": ln.item.code,
                "item_name": ln.item.name,
                "spec": ln.spec,
                "unit": ln.unit,
                "qty": ln.qty,
                "unit_price": ln.unit_price,
                "supply_amount": ln.supply_amount,
                "vat_amount": ln.vat_amount,
                "total": ln.total,
                "note": ln.note,
            })

    today_total = sum((o.total for o in orders), _zero())
    paid_today = (Collection.objects
                  .filter(partner=partner, receipt_date=ymd)
                  .aggregate(s=Sum("amount"))["s"]) or _zero()

    outstanding_before = compute_outstanding(partner, ymd)
    outstanding_after = outstanding_before + today_total - paid_today

    return {
        "company": {
            "name": company.name,
            "biz_no": company.biz_no,
            "rep_name": company.rep_name,
        },
        "partner": {
            "code": partner.code,
            "name": partner.output_name or partner.name,
            "biz_no": partner.biz_no,
            "rep_name": partner.rep_name,
            "address": partner.address,
            "tel": partner.tel,
        },
        "date": ymd,
        "vat_type": orders[0].vat_type if orders else "none",
        "orders": [o.order_no for o in orders],
        "lines": line_rows,
        "subtotal": sum((o.subtotal for o in orders), _zero()),
        "vat_total": sum((o.vat_total for o in orders), _zero()),
        "today_total": today_total,
        "outstanding_before": outstanding_before,
        "paid_today": paid_today,
        "outstanding_after": outstanding_after,
    }
