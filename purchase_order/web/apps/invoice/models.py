"""거래명세서 출력 설정.

pptx slide 7 (image8) 참조 — 16개 옵션을 사용자별 + 회사별로 저장.
더존은 전체 사용자 공통이었는데 docx에서 개인별 설정으로 바꿔달라고 요청.
"""

from __future__ import annotations

from django.db import models


class InvoiceSetting(models.Model):
    """거래명세서 출력 설정 (사용자 × 회사 1건)."""

    PRINT_FORM_CHOICES = [
        ("plain1", "순백지1"),
        ("plain2", "순백지2"),
        ("plain3", "순백지3"),
        ("plain4", "순백지4"),  # 기본
    ]
    REPRESENTATIVE_CHOICES = [
        ("supplier",   "1. 공급자"),
        ("partner_b",  "2. 거래처-기초"),
        ("partner_a",  "3. 거래처-추가"),
        ("delivery",   "4. 배송지"),
    ]
    MEMO_FIELD_CHOICES = [
        ("memo1", "1. 비고1"),
        ("memo2", "2. 비고2"),
        ("memo3", "3. 비고3"),
        ("all",   "4. 전체"),
    ]

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE,
        related_name="invoice_settings", verbose_name="사용자",
    )
    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE,
        related_name="invoice_settings", verbose_name="회사",
    )

    print_form = models.CharField("인쇄형태", max_length=10,
                                  choices=PRINT_FORM_CHOICES, default="plain4")

    # 16개 옵션 (slide 7)
    show_supplier_seal   = models.BooleanField("1. 공급자란 인쇄", default=True)
    show_delivery_addr   = models.BooleanField("2. 배송지주소", default=True)
    show_qty_total       = models.BooleanField("3. 수량계 인쇄", default=True)
    show_vat             = models.BooleanField("4. 부가가치세 표시", default=True)
    show_decimal         = models.BooleanField("5. 소수점 표시", default=True)
    show_qty             = models.BooleanField("6. 수량 표시", default=True)
    show_unit_price      = models.BooleanField("7. 단가 표시", default=True)
    show_amount          = models.BooleanField("8. 금액 표시", default=True)
    show_total_amount    = models.BooleanField("9. 합계금액 표시", default=True)
    show_receivable      = models.BooleanField("10. 채권 표시", default=False)
    representative_type  = models.CharField("11. 담당자 인쇄",
                                            max_length=12, choices=REPRESENTATIVE_CHOICES,
                                            default="supplier")
    show_item_memo       = models.BooleanField("12. 품목비고 표시", default=True)
    invoice_memo_field   = models.CharField("13. 거래명세서비고 표시",
                                            max_length=10, choices=MEMO_FIELD_CHOICES,
                                            default="memo1")
    show_spec            = models.BooleanField("14. 규격 표시", default=True)
    show_tax_amount      = models.BooleanField("15. 순백지1,2 세액 표시", default=True)
    show_today_total     = models.BooleanField("16. 당일거래총액 표시", default=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "명세서 설정"
        verbose_name_plural = "명세서 설정"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "company"], name="uq_invoice_setting_user_company"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} × {self.company.name}"
