"""거래처(Partner) + 계좌(PartnerAccount).

- 모든 거래처는 회사(company)에 종속됩니다 (멀티테넌시).
- 코드(code)는 회사 내에서 유니크합니다.
- simple-history로 변경 이력 자동 추적.
"""

from __future__ import annotations

from django.db import models
from simple_history.models import HistoricalRecords


class Partner(models.Model):
    BIZ_CLASS = [
        ("customer", "매출처"),
        ("vendor",   "매입처"),
        ("both",     "매출+매입"),
    ]
    VAT_TYPES = [("vat", "VAT 포함"), ("none", "VAT 없음")]

    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE,
        related_name="partners", verbose_name="소속 회사",
    )

    code = models.CharField("거래처코드", max_length=20)
    name = models.CharField("거래처명", max_length=120)
    biz_class = models.CharField(
        "거래처 구분", max_length=12, choices=BIZ_CLASS, default="customer",
    )

    biz_no = models.CharField("사업자등록번호", max_length=20, blank=True)
    rep_name = models.CharField("대표자", max_length=60, blank=True)
    biz_kind = models.CharField("업태", max_length=60, blank=True)
    biz_item = models.CharField("종목", max_length=60, blank=True)
    address = models.CharField("사업장주소", max_length=200, blank=True)
    tel = models.CharField("전화번호", max_length=40, blank=True)
    fax = models.CharField("팩스번호", max_length=40, blank=True)
    email = models.EmailField("이메일", max_length=120, blank=True)

    vat_type = models.CharField(
        "VAT 기본값", max_length=10, choices=VAT_TYPES, default="none",
    )

    # 출고처리 시 명세서에 찍히는 이름이 다를 수 있음
    output_name = models.CharField("출력용 거래처명", max_length=120, blank=True)
    memo = models.TextField("비고", blank=True)

    is_active = models.BooleanField("사용", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "거래처"
        verbose_name_plural = "거래처"
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "code"], name="uq_partner_company_code"
            ),
        ]
        indexes = [
            models.Index(fields=["company", "name"]),
        ]

    def __str__(self) -> str:
        return f"{self.code} {self.name}"


class PartnerAccount(models.Model):
    """거래처 계좌. 한 거래처에 여러 계좌 가능."""

    partner = models.ForeignKey(
        Partner, on_delete=models.CASCADE,
        related_name="accounts", verbose_name="거래처",
    )

    bank = models.CharField("은행", max_length=40)
    account_no = models.CharField("계좌번호", max_length=60)
    holder = models.CharField("예금주", max_length=60, blank=True)
    nickname = models.CharField("계좌별칭", max_length=60, blank=True)

    is_default = models.BooleanField("기본 계좌", default=False)
    is_active = models.BooleanField("사용", default=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "거래처 계좌"
        verbose_name_plural = "거래처 계좌"
        ordering = ["-is_default", "bank"]

    def __str__(self) -> str:
        return f"{self.bank} {self.account_no}"
