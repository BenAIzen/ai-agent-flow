"""수금등록 (Collection).

docx image3 참조 — 수금유형 12가지:
  현금/예금/카드/어음/할인(상품)/할인(제품)/선수금(현금)/선수금(예금)
  /선수금정리/상계/잡손실/잡이익

번호: RCP + YYYYMMDD + 6자리.
"""

from __future__ import annotations

from django.db import models, transaction
from simple_history.models import HistoricalRecords


class Collection(models.Model):
    RECEIPT_TYPES = [
        ("cash",          "현금"),
        ("deposit",       "예금"),
        ("card",          "카드"),
        ("note",          "어음"),
        ("discount_prod", "할인(상품)"),
        ("discount_made", "할인(제품)"),
        ("prepay_cash",   "선수금(현금)"),
        ("prepay_dep",    "선수금(예금)"),
        ("prepay_clear",  "선수금정리"),
        ("offset",        "상계"),
        ("misc_loss",     "잡손실"),
        ("misc_gain",     "잡이익"),
    ]

    company = models.ForeignKey(
        "companies.Company", on_delete=models.PROTECT,
        related_name="collections", verbose_name="회사",
    )
    partner = models.ForeignKey(
        "partners.Partner", on_delete=models.PROTECT,
        related_name="collections", verbose_name="거래처",
    )

    receipt_no = models.CharField("수금번호", max_length=24, unique=True)
    receipt_date = models.DateField("수금일자")

    receipt_type = models.CharField(
        "수금유형", max_length=20, choices=RECEIPT_TYPES, default="cash",
    )
    amount = models.DecimalField("금액", max_digits=14, decimal_places=2, default=0)

    bank_account = models.ForeignKey(
        "partners.PartnerAccount", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="collections",
        verbose_name="금융거래처",
    )

    note = models.CharField("적요", max_length=200, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "수금"
        verbose_name_plural = "수금"
        ordering = ["-receipt_date", "-receipt_no"]
        indexes = [
            models.Index(fields=["company", "-receipt_date"]),
            models.Index(fields=["company", "partner", "-receipt_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.receipt_no} {self.partner.name} {self.amount}"

    @classmethod
    def generate_receipt_no(cls, company_id: int, receipt_date) -> str:
        prefix = f"RCP{receipt_date.strftime('%Y%m%d')}"
        with transaction.atomic():
            last = (
                cls.objects.filter(
                    company_id=company_id, receipt_no__startswith=prefix
                ).order_by("-receipt_no").first()
            )
            seq = int(last.receipt_no[len(prefix):]) + 1 if last else 1
            return f"{prefix}{seq:06d}"
