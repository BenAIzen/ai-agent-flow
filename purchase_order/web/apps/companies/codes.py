"""회사 스코프 공용 헬퍼.

채번·정규화·Decimal 변환 같은 도메인 무관 유틸을 한 곳에 모음.
각 앱의 views.py에서 중복 정의됐던 함수들을 통합.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from django.db.models import Model


def next_company_code(model_cls: type[Model], company_id: int, pad: int = 3) -> str:
    """회사 내 다음 코드를 채번 (숫자 코드 중 max + 1, zero-padded).

    Partner / Item 등 (company, code) 유니크 모델에 공통 사용.
    legacy 비숫자 코드는 무시. pad 자릿수 넘어가면 자연스럽게 늘어남.
    """
    rows = model_cls.objects.filter(company_id=company_id).values_list(
        "code", flat=True,
    )
    max_n = 0
    for c in rows:
        if c and c.isdigit():
            n = int(c)
            if n > max_n:
                max_n = n
    return f"{max_n + 1:0{pad}d}"


def normalize_name(name: str) -> str:
    """이름 매칭용 정규화: 양끝 공백 제거 + 다중 공백 단일화.

    Partner / Item 모두 동일 규칙.
    """
    return " ".join((name or "").split())


def to_decimal(v: Any, default: str = "0") -> Decimal:
    """문자열·숫자를 Decimal로. 파싱 실패 시 default Decimal 반환."""
    if v in (None, ""):
        return Decimal(default)
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError):
        return Decimal(default)
