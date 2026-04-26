"""
가락시장 서울청과(주) 최근 1주일 평균가를 수집해 CSV로 저장합니다.

대상 페이지:
    https://www.garak.co.kr/youtong/G1000349/dashboard/auctionStatus/1/page.do?tabId=2

내부적으로는 BIX5 share dashboard(478f1d87...)가 사용하는
db.garak.co.kr:9443 엔드포인트를 호출합니다 (garak_market 컬렉터와 동일 패턴).

서울청과(주)법인코드: 11000101
가락시장 mrktDiv : 1

사용법:
    python flow-price-forecast/scripts/fetch_seoul_cheonggwa.py
    python flow-price-forecast/scripts/fetch_seoul_cheonggwa.py --start 20260420 --end 20260426
    python flow-price-forecast/scripts/fetch_seoul_cheonggwa.py --items "깐양파,양파,청상추(4kg)"

출력: flow-price-forecast/input/recent/recent_prices.csv (품목, 가격, 단위, 일자)
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import io
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests
import urllib3

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SCRIPT_DIR  = Path(__file__).resolve().parent
RECENT_DIR  = SCRIPT_DIR.parent / "input" / "recent"

CORP_CD_SEOUL_CHEONGGWA = "11000101"   # 서울청과(주)
MRKT_DIV_GARAK          = "1"
SHARE_UUID              = "478f1d87c0fd0e43bbd1d4ab5f6c2f10"  # 경매결과 dashboard

BIX5_SHARE_URL = f"https://db.garak.co.kr:9443/shares/{SHARE_UUID}"
BIX5_API_URL   = f"https://db.garak.co.kr:9443/api/datasources/{SHARE_UUID}"


async def _get_jsessionid(share_url: str) -> str:
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context()
        page = await ctx.new_page()
        await page.goto(share_url, timeout=30_000)
        await page.wait_for_timeout(3_000)
        cookies = await ctx.cookies()
        await browser.close()
    for c in cookies:
        if c["name"] == "JSESSIONID":
            return c["value"]
    raise RuntimeError("JSESSIONID 쿠키를 얻지 못했습니다 (Playwright 세션 실패)")


def make_session() -> requests.Session:
    jsess = asyncio.run(_get_jsessionid(BIX5_SHARE_URL))
    s = requests.Session()
    s.cookies.set("JSESSIONID", jsess, domain="db.garak.co.kr")
    s.headers.update({
        "Content-Type": "application/json",
        "Referer": "https://db.garak.co.kr:9443/",
        "User-Agent": "Mozilla/5.0",
    })
    return s


def fetch_window(session: requests.Session, start: str, end: str,
                 corp_cd: str = CORP_CD_SEOUL_CHEONGGWA) -> list[dict]:
    """Pull every row in [start, end] for the given 법인코드.

    payload follows the param shape that newAuction.js builds before opening
    the BIX5 share iframe (mrktDiv, corpCd, selectedDate, itmNm, orgnNm).
    The BIX5 datasource endpoint accepts startDate/endDate variants too — we
    send both to maximize compatibility.
    """
    payload = {
        "mrktDiv":      MRKT_DIV_GARAK,
        "corpCd":       corp_cd,
        "orgnNm":       "",
        "itmNm":        "",
        "startDate":    start,
        "endDate":      end,
        "selectedDate": end,
    }
    url = f"{BIX5_API_URL}?dummy={int(time.time() * 1000)}"
    resp = session.post(url, json=payload, verify=False, timeout=30)
    resp.raise_for_status()
    return resp.json().get("dataset", [])


def aggregate_to_items(rows: list[dict]) -> list[dict]:
    """Reduce raw auction rows to one row per (item, unit): mean of average price."""
    bucket: dict[tuple[str, str], list[float]] = {}
    last_date: dict[tuple[str, str], str] = {}
    for r in rows:
        name = (r.get("ITM_NM") or r.get("RPTV_ITM_NM") or "").strip()
        unit = (r.get("UNIT") or "").strip()
        avg  = r.get("AV_P") or r.get("avg_price")
        d    = r.get("PUR_DD") or r.get("date") or ""
        if not name or avg in (None, "", 0):
            continue
        try:
            avg = float(avg)
        except (TypeError, ValueError):
            continue
        key = (name, unit)
        bucket.setdefault(key, []).append(avg)
        if d > last_date.get(key, ""):
            last_date[key] = d

    out = []
    for (name, unit), vals in bucket.items():
        if not vals:
            continue
        out.append({
            "품목":  name,
            "가격":  round(sum(vals) / len(vals)),
            "단위":  unit,
            "일자":  last_date.get((name, unit), ""),
            "표본": len(vals),
        })
    out.sort(key=lambda x: x["품목"])
    return out


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["품목", "가격", "단위", "일자", "표본"])
        w.writeheader()
        w.writerows(rows)
    print(f"[ok] {path} ({len(rows)}행)")


def main() -> None:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    today = date.today()
    default_end   = today - timedelta(days=1)
    default_start = default_end - timedelta(days=6)

    ap = argparse.ArgumentParser(description="서울청과(주) 최근 1주일 가격 수집기")
    ap.add_argument("--start", default=default_start.strftime("%Y%m%d"),
                    help="시작일 YYYYMMDD (기본: 8일 전)")
    ap.add_argument("--end", default=default_end.strftime("%Y%m%d"),
                    help="종료일 YYYYMMDD (기본: 어제)")
    ap.add_argument("--corp", default=CORP_CD_SEOUL_CHEONGGWA,
                    help="법인코드 (기본: 11000101 서울청과)")
    ap.add_argument("--out", type=Path, default=RECENT_DIR / "recent_prices.csv")
    args = ap.parse_args()

    print(f"[fetch] {args.start} ~ {args.end} 서울청과(주) 가격 수집...")
    print("  → Playwright 세션 초기화...")
    session = make_session()

    print("  → BIX5 datasource 조회...")
    rows = fetch_window(session, args.start, args.end, args.corp)
    if not rows:
        print("  → 데이터 없음 — 페이지에서 직접 export 필요할 수 있음 (SKILL.md 폴백 참조)")
        return

    items = aggregate_to_items(rows)
    write_csv(items, args.out)


if __name__ == "__main__":
    main()
