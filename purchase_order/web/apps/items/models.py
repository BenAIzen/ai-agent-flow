"""품목(Item) 마스터.

regulations:
- 회사(company)에 종속
- 코드(code)는 회사 내 유니크
- 단위가 3종(입고/판매/자재투입)이지만 그린푸드 실무에선 거의 동일 → 1개 필드로
  쓰되 필요시 분리 가능하도록 unit_in / unit_out / unit_stock 분리
- 규격(spec)에 원산지(국내산/수입산/중국산) 등이 들어감
- 출고처리 시 자동 호출되는 거래명세서/세금계산서 출력명 별도 보관
"""

from __future__ import annotations

from django.db import models
from simple_history.models import HistoricalRecords


class Item(models.Model):
    PROCURE_TYPES = [("buy", "구매품"), ("make", "생산품"),
                     ("subcontract", "외주")]
    ACCOUNT_TYPES = [("product", "상품"), ("material", "원재료"),
                     ("sub_material", "부재료"), ("manufactured", "제품"),
                     ("semi", "반제품"), ("byproduct", "부산품"),
                     ("storage", "저장품")]

    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE,
        related_name="items", verbose_name="소속 회사",
    )

    code = models.CharField("품목코드", max_length=30)
    name = models.CharField("품명", max_length=120)
    spec = models.CharField("규격", max_length=60, blank=True)  # 국내산/수입산 등

    procure_type = models.CharField(
        "조달구분", max_length=12, choices=PROCURE_TYPES, default="buy",
    )
    account_type = models.CharField(
        "품목계정", max_length=14, choices=ACCOUNT_TYPES, default="product",
    )

    unit_in = models.CharField("입고단위", max_length=10, default="kg")
    unit_out = models.CharField("출고단위", max_length=10, default="kg")
    unit_stock = models.CharField("재고단위", max_length=10, default="kg")

    # 표준 단가 (거래처별 단가가 없을 때 폴백)
    standard_cost = models.DecimalField(
        "표준원가", max_digits=12, decimal_places=2, default=0,
    )

    # 명세서/세금계산서 출력명 (코드와 다를 수 있음)
    invoice_print_name = models.CharField(
        "거래명세서 출력명", max_length=120, blank=True,
    )

    memo = models.TextField("비고", blank=True)
    is_active = models.BooleanField("사용", default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "품목"
        verbose_name_plural = "품목"
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "code"], name="uq_item_company_code"
            ),
        ]
        indexes = [
            models.Index(fields=["company", "name"]),
        ]

    def __str__(self) -> str:
        return f"{self.code} {self.name}"
