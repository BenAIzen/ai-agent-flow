"""지급등록 (Payment).

1781077524405.png 참조 — 매입처(vendor)에게 지급:
  년/월/일/지급번호/거래처코드/거래처/부서/사원/관리항목/금액/전표상태/매입적용
  하단: 지급유형(현금)/금액/금융거래처

번호: PYZ + YYYYMMDD + 6자리.
"""

from __future__ import annotations

from django.db import models, transaction
from simple_history.models import HistoricalRecords


class Payment(models.Model):
    PAYMENT_TYPES = [
        ("cash",     "현금"),
        ("transfer", "계좌이체"),
        ("check",    "수표"),
        ("note",     "어음"),
        ("card",     "카드"),
        ("offset",   "상계"),
    ]

    company = models.ForeignKey(
        "companies.Company", on_delete=models.PROTECT,
        related_name="payments", verbose_name="회사",
    )
    partner = models.ForeignKey(
        "partners.Partner", on_delete=models.PROTECT,
        related_name="payments", verbose_name="거래처",
    )

    payment_no = models.CharField("지급번호", max_length=24, unique=True)
    payment_date = models.DateField("지급일자")

    payment_type = models.CharField(
        "지급유형", max_length=20, choices=PAYMENT_TYPES, default="cash",
    )
    amount = models.DecimalField("금액", max_digits=14, decimal_places=2, default=0)

    # 지급에 사용한 우리쪽 출금 계좌 or 받는쪽 계좌
    bank_account = models.ForeignKey(
        "partners.PartnerAccount", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="payments",
        verbose_name="금융거래처",
    )

    note = models.CharField("적요", max_length=200, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "지급"
        verbose_name_plural = "지급"
        ordering = ["-payment_date", "-payment_no"]
        indexes = [
            models.Index(fields=["company", "-payment_date"]),
            models.Index(fields=["company", "partner", "-payment_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.payment_no} {self.partner.name} {self.amount}"

    @classmethod
    def generate_payment_no(cls, company_id: int, payment_date) -> str:
        prefix = f"PYZ{payment_date.strftime('%Y%m%d')}"
        with transaction.atomic():
            last = (
                cls.objects.filter(
                    company_id=company_id, payment_no__startswith=prefix
                ).order_by("-payment_no").first()
            )
            seq = int(last.payment_no[len(prefix):]) + 1 if last else 1
            return f"{prefix}{seq:06d}"
