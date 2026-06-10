"""거래처별 단가(PartnerPrice).

docx (3.매장판매^J수금^J단가등록_지수.docx):
  "각 거래처별로 단가가 등록되어있는 거래처코드가 있는데 그 거래처코드 선택
   품목코드로 품목 선택 후 매출단가 부분에 매 월 단가 기입하면
   품목등록에서 발주 처리할 때 단가 자동으로 딸려옴"

매출단가(sale_price)가 매월 바뀔 수 있으므로 effective_from으로 이력 보존.
출고처리에서 단가 조회 시 effective_from <= 발주일자 중 가장 최근 행 선택.

매입단가(purchase_price)는 매입처(vendor)의 경우만 사용.
"""

from __future__ import annotations

from django.db import models
from simple_history.models import HistoricalRecords


class PartnerPrice(models.Model):
    partner = models.ForeignKey(
        "partners.Partner", on_delete=models.CASCADE,
        related_name="prices", verbose_name="거래처",
    )
    item = models.ForeignKey(
        "items.Item", on_delete=models.CASCADE,
        related_name="prices", verbose_name="품목",
    )

    sale_price = models.DecimalField(
        "매출단가", max_digits=12, decimal_places=2, default=0,
    )
    purchase_price = models.DecimalField(
        "매입단가", max_digits=12, decimal_places=2, default=0,
    )

    effective_from = models.DateField(
        "적용 시작일",
        help_text="이 단가가 적용되는 시작 날짜. 출고처리는 발주일자 기준으로 "
                  "가장 최근(이전) 적용일의 단가를 사용합니다.",
    )

    memo = models.CharField("비고", max_length=120, blank=True)
    is_active = models.BooleanField("사용", default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "거래처별 단가"
        verbose_name_plural = "거래처별 단가"
        ordering = ["partner", "item", "-effective_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["partner", "item", "effective_from"],
                name="uq_partner_item_from",
            ),
        ]
        indexes = [
            models.Index(fields=["partner", "item", "-effective_from"]),
        ]

    def __str__(self) -> str:
        return f"{self.partner.name} × {self.item.name} @ {self.effective_from}"


def lookup_sale_price(partner_id: int, item_id: int, ymd) -> "PartnerPrice | None":
    """주어진 날짜에 적용되는 단가 1건. 출고처리에서 호출됨."""
    return (
        PartnerPrice.objects
        .filter(partner_id=partner_id, item_id=item_id,
                effective_from__lte=ymd, is_active=True)
        .order_by("-effective_from")
        .first()
    )
