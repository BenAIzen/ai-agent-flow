"""
Pull 발주날짜 (order date) and 발주업장 (business name) from purchase-order
file *content* — never from filename. Returns ("", "") when nothing matches.

The CLI converter (scripts/convert_purchase_orders.py) falls back to filename
and today's date; the web flow requires real document values, so this module
re-reads the source file independently of the parsers.

Module layout
-------------
* Tunables               — algorithm parameters (scan depth, length bounds)
* Date helpers           — _to_iso, _cell_to_iso, extract_date_from_text
* Business candidate     — single is_business_candidate() filter
* Business text helpers  — _business_from_labels, _business_from_lines
* Format handlers        — extract_from_{xlsx,xls,html,pdf} + their strategies
* Public entry point     — extract_metadata(path)

Rule data (regex patterns, header words, vendor tokens) lives in `rules.py`.
To register a new format or vendor, edit `rules.py` first.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

import openpyxl

try:
    import xlrd
except ImportError:
    xlrd = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from rules import (
    BUSINESS_NEGATIVE_PREFIX,
    DATE_RULES,
    HEADER_WORDS,
    LABEL_BUSINESS_PATTERNS,
    MONTH_EN,
    VENDOR_US_TOKENS_EXACT,
    VENDOR_US_TOKENS_LOWER,
    XLSX_BUSINESS_LABEL_CELLS,
    XLSX_COLUMN_HEADER_HINTS,
)


# ============================================================================ #
# Tunables (algorithm parameters — not coupled to specific rules)              #
# ============================================================================ #

# Max rows scanned per sheet for xlsx/xls. xls has summary-row layouts that
# spread the customer label farther down, so it gets a larger window.
MAX_SCAN_ROWS_XLSX = 12
MAX_SCAN_ROWS_XLS = 30

# How many top text lines to scan when falling back to "first business-looking
# line" heuristic (HTML/PDF/text).
MAX_FALLBACK_LINES_TEXT = 20
MAX_FALLBACK_LINES_PDF_TOP = 6
MAX_LINES_AFTER_PO_HEADER = 4

# Business-name length sanity bounds.
BUSINESS_MIN_LEN = 2
BUSINESS_MAX_LEN = 80


# ============================================================================ #
# Date helpers                                                                 #
# ============================================================================ #

def _to_iso(raw: str) -> str:
    """Normalize a captured date string to YYYY-MM-DD. '' on failure.

    Handles:
      - "07 Apr 2026" / "7 April 2026"
      - "YYYY-MM-DD", "YYYY/MM/DD", "YYYY.MM.DD"
      - "MM/DD/YYYY" / "DD/MM/YYYY"  (disambiguated by first-number > 12)
    """
    s = raw.strip()
    # 07 Apr 2026
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$", s)
    if m:
        d, mon_name, y = m.groups()
        mon = MONTH_EN.get(mon_name.lower()[:4]) or MONTH_EN.get(mon_name.lower()[:3])
        if not mon:
            return ""
        return f"{int(y):04d}-{mon:02d}-{int(d):02d}"

    parts = [p for p in re.split(r"[-/.\s]+", s) if p]
    if len(parts) != 3:
        return ""
    try:
        a, b, c = (int(p) for p in parts)
    except ValueError:
        return ""

    if a >= 1900:           # YYYY first
        y, mo, d = a, b, c
    elif c >= 1900:         # YYYY last
        if a > 12:          # first number can only be day
            d, mo, y = a, b, c
        else:               # default MM/DD/YYYY (used by Birchstreet-KR)
            mo, d, y = a, b, c
    else:
        return ""

    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return ""
    return f"{y:04d}-{mo:02d}-{d:02d}"


def _cell_to_iso(v: object) -> str:
    """Extract leading ISO date from a single cell value. '' if none."""
    if not v:
        return ""
    s = str(v).strip()
    m = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", s)
    if not m:
        return ""
    y, mo, d = (int(x) for x in m.groups())
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return ""
    return f"{y:04d}-{mo:02d}-{d:02d}"


def extract_date_from_text(text: str) -> str:
    """Apply DATE_RULES in priority order; return first match as ISO."""
    if not text:
        return ""
    for rule in DATE_RULES:
        m = re.search(rule.pattern, text, flags=re.IGNORECASE)
        if m:
            iso = _to_iso(m.group(1))
            if iso:
                return iso
    return ""


# ============================================================================ #
# Business candidate filtering — single source of truth                        #
# ============================================================================ #

def _is_vendor_us(s: str) -> bool:
    """True iff s names us (the supplier) rather than a customer."""
    s_low = s.lower()
    if any(tok in s_low for tok in VENDOR_US_TOKENS_LOWER):
        return True
    return any(tok in s for tok in VENDOR_US_TOKENS_EXACT)


def is_business_candidate(s: str) -> bool:
    """Single source of truth: True iff `s` could be a real customer name.

    A candidate is rejected if it is:
      - empty / too short / too long
      - an exact column-header word (HEADER_WORDS)
      - prefixed with a known non-business label (BUSINESS_NEGATIVE_PREFIX)
      - us (Green Food / 그린푸드)
      - purely numeric/punctuation
      - a label ending in ':' / '：'
      - an address starting with digits (e.g., '52 Toegye-ro')
    """
    s = s.strip()
    if not (BUSINESS_MIN_LEN <= len(s) <= BUSINESS_MAX_LEN):
        return False
    if s in HEADER_WORDS:
        return False
    if BUSINESS_NEGATIVE_PREFIX.match(s):
        return False
    if _is_vendor_us(s):
        return False
    if re.match(r"^[\d\-\.\s/:]+$", s):
        return False
    if s.endswith(":") or s.endswith("："):
        return False
    if re.match(r"^\d+\s", s):
        return False
    return True


# ============================================================================ #
# Business extraction — text-based                                             #
# ============================================================================ #

def _business_from_labels(text: str) -> str:
    """Try every labelled pattern from rules; return the first valid match."""
    for pat in LABEL_BUSINESS_PATTERNS:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            cand = m.group(1).strip().rstrip(",;")
            if is_business_candidate(cand):
                return cand
    return ""


def _business_from_lines(
    lines: Iterable[str],
    *,
    after_marker: re.Pattern[str] | None = None,
    window: int = MAX_FALLBACK_LINES_TEXT,
) -> str:
    """Scan a sequence of lines for the first business-candidate.

    If `after_marker` is given, only consider lines appearing within `window`
    lines AFTER a marker-matching line (HTML/PDF "PURCHASE ORDER" anchor).
    Otherwise scan the first `window` lines.
    """
    lines = list(lines)
    if after_marker is not None:
        for i, ln in enumerate(lines):
            if after_marker.match(ln):
                for nxt in lines[i + 1: i + 1 + window]:
                    if is_business_candidate(nxt):
                        return nxt
        return ""
    for ln in lines[:window]:
        if is_business_candidate(ln):
            return ln
    return ""


def extract_business_from_text(text: str) -> str:
    if not text:
        return ""
    labelled = _business_from_labels(text)
    if labelled:
        return labelled
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return _business_from_lines(lines, window=MAX_FALLBACK_LINES_TEXT)


# ============================================================================ #
# Format handler: XLSX                                                         #
# ============================================================================ #

def _xlsx_collect_rows(ws, limit: int) -> list[list[str]]:
    """Read up to `limit` rows of `ws` as plain-string grids."""
    rows: list[list[str]] = []
    for r in range(1, min(ws.max_row, limit) + 1):
        rows.append(["" if c.value is None else str(c.value) for c in ws[r]])
    return rows


def _xlsx_date_from_text(rows: list[list[str]]) -> str:
    """Run DATE_RULES against the joined text of all rows."""
    return extract_date_from_text("\n".join(" ".join(r) for r in rows))


def _xlsx_date_from_cells(rows: list[list[str]]) -> str:
    """Look at each cell individually for an ISO-shaped date value."""
    for row in rows:
        for v in row:
            iso = _cell_to_iso(v)
            if iso:
                return iso
    return ""


def _xlsx_business_from_label_cell(rows: list[list[str]]) -> str:
    """Find a cell with text in XLSX_BUSINESS_LABEL_CELLS and return the first
    non-empty, non-vendor cell on the same row to its right.
    """
    for row in rows:
        for i, v in enumerate(row):
            label = v.strip() if isinstance(v, str) else ""
            if label in XLSX_BUSINESS_LABEL_CELLS:
                for j in range(i + 1, len(row)):
                    cand = (row[j] or "").strip()
                    if cand and not _is_vendor_us(cand):
                        return cand
    return ""


def _xlsx_business_from_title_row(rows: list[list[str]]) -> str:
    """Pick a business-looking value from row 0, but only if row 0 is a
    *title* row, not the column-header row itself.

    Rejects values that also occur on rows 2-4 (they are column headers),
    contact/date strings, and "그린푸드 6월 18일" sheet-title pattern.
    """
    if not rows:
        return ""
    row0 = rows[0]
    header_hits = sum(
        1 for v in row0 if isinstance(v, str) and v.strip() in XLSX_COLUMN_HEADER_HINTS
    )
    if header_hits >= 3:
        return ""

    # Build a set of strings that appear on rows 2-4 → these are column
    # headers shifted down, never a business name.
    repeated_below: set[str] = set()
    for hr in rows[1:5]:
        for v in hr:
            s = (v or "").strip() if isinstance(v, str) else ""
            if s:
                repeated_below.add(s)

    for v in row0:
        s = (v or "").strip() if isinstance(v, str) else ""
        if not s or s in repeated_below:
            continue
        if not is_business_candidate(s):
            continue
        if "팩스" in s or "TEL" in s.upper() or "FAX" in s.upper():
            continue
        if re.match(r"^\d{4}", s):
            continue
        if re.search(r"\d{1,2}\s*월\s*\d{1,2}\s*일", s):
            # e.g. "그린푸드 6월 18일" — a sheet title, not a customer
            continue
        return s
    return ""


def extract_from_xlsx(path: Path) -> tuple[str, str]:
    wb = openpyxl.load_workbook(path, data_only=True)
    found_date = ""
    found_biz = ""
    for sn in wb.sheetnames:
        rows = _xlsx_collect_rows(wb[sn], MAX_SCAN_ROWS_XLSX)
        if not found_date:
            found_date = _xlsx_date_from_text(rows) or _xlsx_date_from_cells(rows)
        if not found_biz:
            found_biz = (
                _xlsx_business_from_label_cell(rows)
                or _xlsx_business_from_title_row(rows)
            )
        if found_date and found_biz:
            break
    return found_date, found_biz


# ============================================================================ #
# Format handler: XLS  (legacy .xls — currently only 호암교수회관 양식)        #
# ============================================================================ #

# Pattern for the hoam-style "all in one cell" label:
#   "영 업 장 :    022   직원식당(2)"
# Tightly coupled to _hoam_business_from_cell — not a general rule, so it
# stays in this module rather than rules.py.
_HOAM_BUSINESS_CELL = re.compile(r"^\s*영\s*업\s*장\s*[:：]\s*\d*\s+([^\d].+)$")


def extract_from_xls(path: Path) -> tuple[str, str]:
    if xlrd is None:
        return "", ""
    wb = xlrd.open_workbook(path)
    ws = wb.sheet_by_index(0)
    rows = [
        [str(v) if v is not None else "" for v in ws.row_values(r)]
        for r in range(min(ws.nrows, MAX_SCAN_ROWS_XLS))
    ]
    text = "\n".join(" ".join(r) for r in rows)

    found_date = extract_date_from_text(text) or _xlsx_date_from_cells(rows)

    found_biz = ""
    for row in rows:
        for v in row:
            m = _HOAM_BUSINESS_CELL.match(v)
            if m:
                cand = m.group(1).strip()
                if is_business_candidate(cand):
                    found_biz = cand
                    break
        if found_biz:
            break
    if not found_biz:
        found_biz = extract_business_from_text(text)
    return found_date, found_biz


# ============================================================================ #
# Format handler: HTML                                                         #
# ============================================================================ #

# Tightly coupled to extract_from_html (used as the `after_marker` for the
# line scan), so this stays here rather than rules.py.
_PO_HEADER_MARKER = re.compile(
    r"^(PURCHASE\s*ORDER|구매\s*주문|발\s*주\s*서)", flags=re.IGNORECASE
)


def extract_from_html(path: Path) -> tuple[str, str]:
    if BeautifulSoup is None:
        return "", ""
    with open(path, "rb") as f:
        soup = BeautifulSoup(f.read(), "lxml")
    text = soup.get_text("\n", strip=True)

    found_date = extract_date_from_text(text)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    found_biz = _business_from_lines(
        lines,
        after_marker=_PO_HEADER_MARKER,
        window=MAX_LINES_AFTER_PO_HEADER,
    )
    if not found_biz:
        found_biz = extract_business_from_text(text)
    return found_date, found_biz


# ============================================================================ #
# Format handler: PDF                                                          #
# ============================================================================ #

def extract_from_pdf(path: Path) -> tuple[str, str]:
    if pdfplumber is None:
        return "", ""
    try:
        with pdfplumber.open(path) as pdf:
            text = pdf.pages[0].extract_text() or ""
    except Exception:
        return "", ""

    found_date = extract_date_from_text(text)

    # Try labelled first (DELIVERY TO, 발주서 prefix, etc.), then top-of-doc scan.
    found_biz = _business_from_labels(text)
    if not found_biz:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for ln in lines[:MAX_FALLBACK_LINES_PDF_TOP]:
            if is_business_candidate(ln) and "PURCHASE ORDER" not in ln.upper():
                found_biz = ln
                break
    return found_date, found_biz


# ============================================================================ #
# Public entry point                                                           #
# ============================================================================ #

_HANDLERS = {
    ".xlsx": extract_from_xlsx,
    ".xls":  extract_from_xls,
    ".html": extract_from_html,
    ".pdf":  extract_from_pdf,
}


def extract_metadata(path: Path) -> tuple[str, str]:
    """Dispatch by extension. Returns (발주날짜, 발주업장), '' if not found."""
    handler = _HANDLERS.get(path.suffix.lower())
    if handler is None:
        return "", ""
    try:
        return handler(path)
    except Exception:
        return "", ""
