"""출고처리 (DeliveryOrder + DeliveryLine).

pptx slide 3-4 참조:
- 상단: 일자 / 출고번호 / 거래처코드 / 거래처 / VAT여부 / 과세구분
- 하단: 품목코드 / 품명 / 규격 / 단위 / 수량 / 단가 / 공급가액 / 부가세 / 합계

규칙:
- VAT 포함: 공급가액 = 단가 × 수량 / 부가세 = 공급가액 × 10%
- VAT 없음: 공급가액 = 단가 × 수량 / 부가세 = 0
- 단가는 거래처별 단가에서 자동 호출 (없으면 표준원가, 그것도 없으면 0)
- 출고번호는 STX + YYYYMMDD + 일련번호(6자리) 자동 생성
"""

from __future__ import annotations

from decimal import Decimal

from django.db import models, transaction
from simple_history.models import HistoricalRecords


class DeliveryOrder(models.Model):
    """출고전표 (헤더)."""

    VAT_TYPES = [("vat", "VAT 포함"), ("none", "VAT 없음")]
    TAX_TYPES = [("taxable", "과세"), ("exempt", "면세"), ("zero", "영세")]
    STATUS = [("draft", "작성중"), ("confirmed", "완료"), ("voided", "취소")]

    company = models.ForeignKey(
        "companies.Company", on_delete=models.PROTECT,
        related_name="deliveries", verbose_name="회사",
    )
    partner = models.ForeignKey(
        "partners.Partner", on_delete=models.PROTECT,
        related_name="deliveries", verbose_name="거래처",
    )

    order_no = models.CharField("출고번호", max_length=24, unique=True)
    order_date = models.DateField("출고일자")

    vat_type = models.CharField("VAT 여부", max_length=10, choices=VAT_TYPES, default="none")
    tax_type = models.CharField("과세구분", max_length=10, choices=TAX_TYPES, default="exempt")
    status = models.CharField("전표상태", max_length=12, choices=STATUS, default="confirmed")

    note = models.CharField("적요", max_length=200, blank=True)

    # 집계 — line 저장 시 trigger로 갱신
    subtotal = models.DecimalField("공급가액 합계", max_digits=14, decimal_places=2, default=0)
    vat_total = models.DecimalField("부가세 합계", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField("총 합계금액", max_digits=14, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "출고전표"
        verbose_name_plural = "출고전표"
        ordering = ["-order_date", "-order_no"]
        indexes = [
            models.Index(fields=["company", "-order_date"]),
            models.Index(fields=["company", "partner", "-order_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.order_no} {self.partner.name}"

    def recompute_totals(self) -> None:
        agg = self.lines.aggregate(
            subtotal=models.Sum("supply_amount"),
            vat=models.Sum("vat_amount"),
        )
        sub = agg["subtotal"] or Decimal("0")
        vat = agg["vat"] or Decimal("0")
        self.subtotal = sub
        self.vat_total = vat
        self.total = sub + vat
        DeliveryOrder.objects.filter(pk=self.pk).update(
            subtotal=self.subtotal, vat_total=self.vat_total, total=self.total,
        )

    @classmethod
    def generate_order_no(cls, company_id: int, order_date) -> str:
        """STX + YYYYMMDD + 6자리. 같은 회사·날짜 안에서 일련번호 순증."""
        prefix = f"STX{order_date.strftime('%Y%m%d')}"
        with transaction.atomic():
            last = (
                cls.objects.filter(
                    company_id=company_id, order_no__startswith=prefix
                ).order_by("-order_no").first()
            )
            if last:
                seq = int(last.order_no[len(prefix):]) + 1
            else:
                seq = 1
            return f"{prefix}{seq:06d}"


class DeliveryLine(models.Model):
    """출고전표 라인."""

    order = models.ForeignKey(
        DeliveryOrder, on_delete=models.CASCADE,
        related_name="lines", verbose_name="출고전표",
    )
    item = models.ForeignKey(
        "items.Item", on_delete=models.PROTECT,
        related_name="delivery_lines", verbose_name="품목",
    )

    spec = models.CharField("규격", max_length=60, blank=True)   # 보통 item.spec 복사
    unit = models.CharField("단위", max_length=10, blank=True)   # 보통 item.unit_out 복사
    qty = models.DecimalField("수량", max_digits=12, decimal_places=3, default=0)
    unit_price = models.DecimalField("단가", max_digits=12, decimal_places=2, default=0)

    supply_amount = models.DecimalField("공급가액", max_digits=14, decimal_places=2, default=0)
    vat_amount = models.DecimalField("부가세", max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField("합계금액", max_digits=14, decimal_places=2, default=0)

    note = models.CharField("비고", max_length=120, blank=True)

    class Meta:
        verbose_name = "출고 라인"
        verbose_name_plural = "출고 라인"
        ordering = ["id"]

    def compute(self, vat_type: str) -> None:
        self.supply_amount = (self.qty * self.unit_price).quantize(Decimal("0.01"))
        if vat_type == "vat":
            self.vat_amount = (self.supply_amount * Decimal("0.1")).quantize(Decimal("0.01"))
        else:
            self.vat_amount = Decimal("0")
        self.total = self.supply_amount + self.vat_amount

    def __str__(self) -> str:
        return f"{self.order.order_no} {self.item.name} × {self.qty}"
