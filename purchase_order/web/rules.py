"""
Format-recognition rules for purchase-order extraction.

This module is **data-only** — no logic, no I/O. It defines the patterns and
word lists that `extractors.py` applies when scanning a file.

Adding a new customer or new vendor format usually means editing this file:
    1) New date label?       → append a `DateRule` to `DATE_RULES`
    2) New business label?   → append a regex to `LABEL_BUSINESS_PATTERNS`
    3) New header word?      → add to `HEADER_WORDS`
    4) Misidentified line?   → add a prefix to `BUSINESS_NEGATIVE_PREFIX`

Naming convention: symbols here are imported from `extractors.py`, so they
use PUBLIC names (no leading underscore).
"""

from __future__ import annotations

import re
from dataclasses import dataclass


# ============================================================================ #
# Date rules                                                                   #
# ============================================================================ #

@dataclass(frozen=True)
class DateRule:
    """A labelled regex used to find an order date in document text.

    The regex must have exactly one capture group: the date string itself
    (whose format will be normalized by `extractors._to_iso`).

    `name` is used for debugging / future logging — never for matching.
    """
    name: str
    pattern: str


# Ordered by priority. The first matching rule wins.
#
# WARNING — order matters:
#   * 발주일자 / PO Date / PO Submit Date come first because they are the
#     TRUE order date.
#   * `일자` (line 53 below) has a lookbehind to avoid 입고일자 / 사용예정일.
#   * Delivery-date rules are last — they are a fallback only.
DATE_RULES: list[DateRule] = [
    DateRule("발주일자",
             r"발\s*주\s*일\s*자\s*[:：]?\s*(\d{4}[-/.\s]\d{1,2}[-/.\s]\d{1,2})"),
    DateRule("PO DATE",
             r"PO\s*DATE\s*[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"),
    DateRule("PO Date",
             r"PO\s*Date\s*[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"),
    DateRule("PO Submit Date",
             r"PO\s*Submit\s*Date\s*[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"),
    DateRule("PO 제출 날짜",
             r"PO\s*제출\s*날짜\s*[:：]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})"),
    DateRule("발주 날짜",
             r"발\s*주\s*날\s*짜\s*[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"),
    # Lookbehind avoids 입고일자 / 사용예정일 / 과거예정일.
    DateRule("일자",
             r"(?<![고예정])일\s*자\s*[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"),
    DateRule("Delivery Date (en-word)",
             r"Delivery\s*Date\s*[:：]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})"),
    DateRule("Delivery date (iso)",
             r"Delivery\s*date\s*[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"),
    DateRule("배송 날짜",
             r"배\s*송\s*날\s*짜\s*[:：]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})"),
    DateRule("Delivery (bare iso)",
             r"Delivery\s*[:：]\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})"),
]


# English month abbreviations / names for the IHG-style "07 Apr 2026" format.
MONTH_EN: dict[str, int] = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}


# ============================================================================ #
# Business name patterns                                                       #
# ============================================================================ #

# Distance constant used by the 거래명세표 anchor pattern below. This is part
# of a rule (not an algorithm parameter), so it lives here.
RECEIVING_RECORD_ANCHOR_GAP = 40


# Labelled business-name regexes, tried in order before the line-scan fallback.
# Each must have one capture group = the business name.
LABEL_BUSINESS_PATTERNS: list[str] = [
    # Korean 발주서 top line, e.g.:  "발 주 서  ROKAUS HOTEL"
    r"발\s*주\s*서\s+([^\n\r]{2,80})",
    # Birchstreet "DELIVERY TO :" with trailing field anchors.
    r"DELIVERY\s*TO\s*[:：]\s*([^\n\r]+?)"
    r"(?=\s+ADDRESS|\s+CONTACT|\s+PO\s|\s+TEL|\s*[\n\r]|$)",
    # Birchstreet "BILL TO :".
    r"BILL\s*TO\s*[:：]\s*([^\n\r]+?)"
    r"(?=\s+ADDRESS|\s+CONTACT|\s+TEL|\s*[\n\r]|$)",
    # Korean Birchstreet "배송:" line.
    r"배\s*송\s*[:：]\s*([^\n\r]+?)"
    r"(?=\s+\d|\s+서울|\s+인천|\s*[\n\r]|$)",
    # 거래명세표 layout (홀리송도): "받 ... 상 호 <buyer>"
    # Anchored on 받 so we grab the BUYER row, not the 공급자 (vendor) row.
    rf"받[\s\S]{{0,{RECEIVING_RECORD_ANCHOR_GAP}}}?상\s*호\s+([^\n\r]+?)"
    r"(?=\s+대\s+|\s{2,}|\s+표|[\n\r]|$)",
]


# ============================================================================ #
# Business candidate rejection rules                                           #
# ============================================================================ #

# Exact-match column-header words. A candidate equal to one of these is
# definitely not a business name.
HEADER_WORDS: frozenset[str] = frozenset({
    "No", "no", "NO",
    "품목명", "품명", "품목코드", "규격", "구매규격", "재고규격",
    "단위", "품목단위", "재고단위", "수량", "단가", "금액", "비고",
    "날짜", "일자", "발주서", "그린푸드 발주서",
    "Item Code", "Item Name", "Description", "Qty", "Unit Price",
})


# Strings whose PREFIX matches this regex are not customer names — they are
# document labels, section headers, our own company, or contact/address lines.
BUSINESS_NEGATIVE_PREFIX: re.Pattern[str] = re.compile(
    r"^("
    # document type
    r"PURCHASE\s*ORDER|구매\s*주문|발\s*주\s*서|RECEIVING\s*RECORD|거\s*래\s*명\s*세\s*표"
    # labels
    r"|Order\s*For|Order\s*Sent|Order\s*By|Delivery|PO\s*N|PR\s*N|SUPPLIER|Vendor|VENDOR"
    r"|업체명|업\s*장|Account\s*Code|Cost\s*Centre"
    # us (the supplier)
    r"|GREEN\s*FOOD|그린푸드|\(주\)그린푸드|㈜그린푸드"
    # contact / address
    r"|T\s*E\s*L|TEL|FAX|서울|인천|경기"
    r"|주\s*소|ADDRESS|Phone|Email|이메일|전화|팩스|Telephone"
    r")",
    flags=re.IGNORECASE,
)


# Tokens that, when found ANYWHERE in a candidate string, mean the line names
# US (the supplier, Green Food) — not the customer.
VENDOR_US_TOKENS_LOWER: tuple[str, ...] = ("green food", "greenfood")
VENDOR_US_TOKENS_EXACT: tuple[str, ...] = ("그린푸드", "(주)그린푸드", "㈜그린푸드")


# ============================================================================ #
# XLSX-specific rules                                                          #
# ============================================================================ #

# Label cells whose RIGHT-neighbour cell holds the business name.
XLSX_BUSINESS_LABEL_CELLS: tuple[str, ...] = ("업체명", "업장", "거래처명", "업장명")


# When 3+ of these appear in row 0, that row IS the column-header row — so
# there is no separate title row, and no business name to find in this sheet.
# (Overlaps with `HEADER_WORDS` but is used by a different test, so kept
# separate to avoid coupling the two checks.)
XLSX_COLUMN_HEADER_HINTS: frozenset[str] = frozenset({
    "품목명", "품명", "품목코드", "규격", "구매규격", "재고규격",
    "단위", "품목단위", "재고단위", "수량", "단가", "금액", "비고",
    "Item Code", "Item Name", "Description", "Qty", "Unit Price",
})
