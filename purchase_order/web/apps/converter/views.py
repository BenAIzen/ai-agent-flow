"""PO converter — multipart upload + xlsx download."""

from __future__ import annotations

import tempfile
import uuid
from datetime import date as date_cls, timedelta
from pathlib import Path
from typing import Any

from django.db import IntegrityError, transaction
from django.http import FileResponse, Http404
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.codes import normalize_name, to_decimal
from apps.companies.mixins import get_request_company
from apps.delivery.models import DeliveryLine, DeliveryOrder
from apps.items.models import Item
from apps.items.views import next_item_code
from apps.partners.models import Partner
from apps.partners.views import next_partner_code
from apps.prices.models import PartnerPrice

# 모듈 내 짧은 별칭 (정규화 규칙은 partner/item 동일)
normalize_partner_name = normalize_name
normalize_item_name = normalize_name


def default_delivery_date() -> str:
    """추출 실패 시 기본 출고일자.

    오늘 +1일. 단, 오늘이 금요일이면 +2일 (사용자 정책).
    """
    today = date_cls.today()
    days_ahead = 2 if today.weekday() == 4 else 1   # 금요일=4
    return (today + timedelta(days=days_ahead)).isoformat()

from .services import (
    OUT_COLUMNS,
    build_workbook,
    extract_metadata,
    parse_uploaded,
)


def _safe_decimal(val: Any) -> str:
    """PO에서 추출한 수량/단가를 string으로 정규화 (Decimal 직렬화 호환).
    Returns "0" if not parseable.
    """
    if val is None or val == "":
        return "0"
    try:
        return str(float(val))
    except (TypeError, ValueError):
        return "0"


def analyze_candidates(
    company_id: int, file_groups: list[dict[str, Any]],
) -> dict[str, Any]:
    """파일 그룹별로 4종 후보 분석.

    Args:
        file_groups: [{"business": "...", "date": "YYYY-MM-DD", "lines": [...]}, ...]

    Returns:
        {
          "partners":  [{"name": ...}],
          "items":     [{"partner_name", "is_new_partner", "name", "unit"}],
          "prices":    [{"partner_name", "item_name", "sale_price", "effective_from"}],
          "orders":    [{"partner_name", "order_date", "is_new_partner",
                          "lines": [{"item_name", "spec", "unit", "qty", "unit_price"}]}],
          "matched": {"items": N, "prices": M},
        }
    """
    # ── 인덱스 ────────────────────────────────────────────
    existing_partners = {
        normalize_partner_name(name): pid
        for pid, name in Partner.objects.filter(
            company_id=company_id,
        ).values_list("id", "name")
    }
    existing_items: set[tuple[int | None, str]] = {
        (pid, normalize_item_name(n))
        for pid, n in Item.objects.filter(
            company_id=company_id,
        ).values_list("partner_id", "name")
    }
    # 단가 dedup: (partner_id, item_id, effective_from)
    existing_prices: set[tuple[int, int, str]] = {
        (p, i, str(d))
        for p, i, d in PartnerPrice.objects.values_list(
            "partner_id", "item_id", "effective_from",
        )
    }

    new_partner_seen: set[str] = set()
    partners: list[dict[str, str]] = []

    new_item_seen: set[tuple[str, str]] = set()
    items: list[dict[str, Any]] = []
    items_matched = 0

    new_price_seen: set[tuple[str, str, str]] = set()
    prices: list[dict[str, Any]] = []
    prices_matched = 0

    orders: list[dict[str, Any]] = []

    for grp in file_groups:
        partner_norm = normalize_partner_name(grp.get("business") or "")
        order_date = grp.get("date") or ""

        is_new_partner = bool(partner_norm) and partner_norm not in existing_partners
        if is_new_partner and partner_norm not in new_partner_seen:
            new_partner_seen.add(partner_norm)
            partners.append({"name": partner_norm})

        partner_id = existing_partners.get(partner_norm)

        order_lines: list[dict[str, Any]] = []

        for line in grp.get("lines", []):
            raw = line.get("품명") or line.get("품목명") or ""
            item_norm = normalize_item_name(raw)
            if not item_norm:
                continue

            unit = (line.get("단위") or "kg").strip() or "kg"
            qty = _safe_decimal(line.get("수량"))
            price = _safe_decimal(line.get("단가"))

            # 1) 품목 후보 (없으면)
            item_key = (partner_id, item_norm)
            if item_key in existing_items:
                items_matched += 1
            elif (partner_norm, item_norm) not in new_item_seen:
                new_item_seen.add((partner_norm, item_norm))
                items.append({
                    "partner_name": partner_norm,
                    "is_new_partner": is_new_partner,
                    "name": item_norm,
                    "unit": unit,
                })

            # 2) 단가 후보 (price > 0 일 때만 가치 있음)
            if float(price) > 0:
                # 기존 (partner, item, date) 매칭은 item_id가 있어야 가능
                item_id = None
                if partner_id:
                    # 기존 품목 매칭 시도
                    for (pid, name) in [(partner_id, item_norm)]:
                        if (pid, name) in existing_items:
                            # item_id를 찾아옴 (느리지만 1회만)
                            item_id = Item.objects.filter(
                                company_id=company_id, partner_id=pid, name=name,
                            ).values_list("id", flat=True).first()
                price_key = (partner_norm, item_norm, order_date)
                if item_id and order_date and (
                    partner_id, item_id, order_date,
                ) in existing_prices:
                    prices_matched += 1
                elif price_key not in new_price_seen:
                    new_price_seen.add(price_key)
                    prices.append({
                        "partner_name": partner_norm,
                        "item_name": item_norm,
                        "sale_price": price,
                        "effective_from": order_date,
                    })

            # 3) 출고 라인 (파일별 누적)
            order_lines.append({
                "item_name": item_norm,
                "spec": "",
                "unit": unit,
                "qty": qty,
                "unit_price": price,
            })

        # 출고전표 후보 (라인 있을 때만)
        if order_lines and partner_norm:
            orders.append({
                "partner_name": partner_norm,
                "is_new_partner": is_new_partner,
                "order_date": order_date,
                "lines": order_lines,
            })

    return {
        "partners": partners,
        "items": items,
        "prices": prices,
        "orders": orders,
        "matched": {"items": items_matched, "prices": prices_matched},
    }

# In-memory single-use download tokens. Keys are UUIDs returned to the
# frontend; the bytes are deleted once downloaded.
# NOTE: this is intentionally in-process — moves to S3/Redis in Phase 4.
_DOWNLOADS: dict[str, tuple[bytes, str]] = {}


class ConvertView(APIView):
    """POST /api/convert  — multipart upload one or more PO files."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        files = request.FILES.getlist("files")
        if not files:
            return Response({"detail": "No files uploaded"}, status=400)

        summary: list[dict[str, Any]] = []
        combined_rows: list[dict[str, Any]] = []
        # 파일별 그룹 — 거래처 자동 추출 분석용
        file_groups: list[dict[str, Any]] = []

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            for uf in files:
                if not uf.name:
                    continue
                tmp_path = tmp / uf.name
                with open(tmp_path, "wb") as out:
                    for chunk in uf.chunks():
                        out.write(chunk)

                doc, status = parse_uploaded(tmp_path)
                entry: dict[str, Any] = {
                    "file": uf.name,
                    "status": status,
                    "date": "",
                    "business": "",
                    "line_count": 0,
                    "lines": [],
                }
                if status != "ok" or doc is None:
                    summary.append(entry)
                    continue

                date, business = extract_metadata(tmp_path)
                if not date:
                    date = default_delivery_date()
                    entry["date_fallback"] = True
                entry["date"] = date
                entry["business"] = business
                entry["line_count"] = len(doc.lines)
                entry["lines"] = [
                    {
                        "품목코드": line.품목코드,
                        "품명": line.품목명,
                        "수량": line.수량,
                        "단위": line.단위,
                        "단가": line.단가,
                    }
                    for line in doc.lines
                ]
                summary.append(entry)
                file_groups.append({
                    "business": business, "date": date,
                    "lines": entry["lines"],
                })

                for line in doc.lines:
                    combined_rows.append({
                        "발주날짜": date,
                        "발주업장": business,
                        "품목코드": line.품목코드,
                        "품명": line.품목명,
                        "수량": line.수량,
                        "단위": line.단위,
                        "단가": line.단가,
                    })

        download_id = ""
        if combined_rows:
            download_id = uuid.uuid4().hex
            data = build_workbook(combined_rows)
            _DOWNLOADS[download_id] = (
                data, f"발주서_변환_{download_id[:8]}.xlsx"
            )

        # 4종(거래처/품목/단가/출고) 후보 분석 — 실제 생성은 안 함.
        # 사용자가 화면에서 검토·편집 후 /api/convert/commit 로 확정.
        candidates: dict[str, Any] = {
            "partners": [], "items": [], "prices": [], "orders": [],
            "matched": {"items": 0, "prices": 0},
        }
        try:
            company = get_request_company(request)
            candidates = analyze_candidates(company.id, file_groups)
        except Exception:
            pass

        return Response({
            "summary": summary,
            "download_id": download_id,
            "total_rows": len(combined_rows),
            "new_partner_candidates": candidates["partners"],
            "new_item_candidates": candidates["items"],
            "new_price_candidates": candidates["prices"],
            "new_order_candidates": candidates["orders"],
            "items_matched": candidates["matched"]["items"],
            "prices_matched": candidates["matched"]["prices"],
        })


_to_decimal = to_decimal  # 호환 별칭 (기존 _to_decimal 호출 그대로 작동)


class CommitView(APIView):
    """POST /api/convert/commit — 사용자가 검토한 4종 후보를 일괄 등록.

    Body:
      {
        "partners": [{"name": "..."}],
        "items":    [{"partner_name": "...", "name": "...", "unit": "kg"}],
        "prices":   [{"partner_name", "item_name", "sale_price", "effective_from"}],
        "orders":   [{"partner_name", "order_date", "vat_type"?, "tax_type"?,
                       "lines": [{"item_name", "spec", "unit", "qty", "unit_price"}]}]
      }

    처리 순서:
      1. 거래처 (get_or_create by 정규화 이름, 자동 채번)
      2. 품목 (partner 해결 후, 회사 내 (partner, name) 중복 검사)
      3. 단가 (partner+item 해결, (partner, item, effective_from) 중복 검사)
      4. 출고전표 (partner 해결, order_no 자동, lines 일괄 생성, totals 재계산)

    원자성: 전체를 transaction.atomic()으로 감싸 한 곳이라도 실패하면 롤백.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        company = get_request_company(request)
        body = request.data or {}

        partners_in = body.get("partners") or []
        items_in = body.get("items") or []
        prices_in = body.get("prices") or []
        orders_in = body.get("orders") or []

        # 응답용 집계
        created_partners: list[dict] = []
        created_items: list[dict] = []
        created_prices: list[dict] = []
        created_orders: list[dict] = []
        skipped = {"partners": 0, "items": 0, "prices": 0, "orders": 0}

        # 이름 → Partner 캐시 (한 트랜잭션 동안)
        partner_cache: dict[str, Partner] = {}

        def resolve_partner(name: str) -> Partner | None:
            norm = normalize_partner_name(name)
            if not norm:
                return None
            if norm in partner_cache:
                return partner_cache[norm]
            obj = Partner.objects.filter(company_id=company.id, name=norm).first()
            if obj:
                partner_cache[norm] = obj
            return obj

        # 이름 → Item 캐시 (partner_id, item_name) 기준
        item_cache: dict[tuple[int, str], Item] = {}

        def resolve_item(partner: Partner, name: str) -> Item | None:
            norm = normalize_item_name(name)
            if not norm:
                return None
            key = (partner.id, norm)
            if key in item_cache:
                return item_cache[key]
            obj = Item.objects.filter(
                company_id=company.id, partner_id=partner.id, name=norm,
            ).first()
            if obj:
                item_cache[key] = obj
            return obj

        try:
            with transaction.atomic():
                # ─── 1. 거래처 ───────────────────────────
                for entry in partners_in:
                    if not isinstance(entry, dict):
                        continue
                    norm = normalize_partner_name(entry.get("name") or "")
                    if not norm:
                        continue
                    existing = Partner.objects.filter(
                        company_id=company.id, name=norm,
                    ).first()
                    if existing:
                        partner_cache[norm] = existing
                        skipped["partners"] += 1
                        continue
                    try:
                        with transaction.atomic():
                            p = Partner.objects.create(
                                company_id=company.id,
                                code=next_partner_code(company.id),
                                name=norm,
                                biz_class="customer",
                            )
                        partner_cache[norm] = p
                        created_partners.append({
                            "id": p.id, "code": p.code, "name": p.name,
                        })
                    except IntegrityError:
                        skipped["partners"] += 1

                # ─── 2. 품목 ─────────────────────────────
                for entry in items_in:
                    if not isinstance(entry, dict):
                        continue
                    name = normalize_item_name(entry.get("name") or "")
                    if not name:
                        continue
                    partner = resolve_partner(entry.get("partner_name") or "")
                    if partner is None:
                        skipped["items"] += 1
                        continue
                    existing = resolve_item(partner, name)
                    if existing:
                        skipped["items"] += 1
                        continue
                    unit = (entry.get("unit") or "kg").strip() or "kg"
                    try:
                        with transaction.atomic():
                            it = Item.objects.create(
                                company_id=company.id,
                                partner=partner,
                                code=next_item_code(company.id),
                                name=name,
                                unit_in=unit, unit_out=unit, unit_stock=unit,
                            )
                        item_cache[(partner.id, name)] = it
                        created_items.append({
                            "id": it.id, "code": it.code,
                            "name": it.name, "unit_out": it.unit_out,
                            "partner_id": partner.id, "partner_name": partner.name,
                        })
                    except IntegrityError:
                        skipped["items"] += 1

                # ─── 3. 단가 ─────────────────────────────
                for entry in prices_in:
                    if not isinstance(entry, dict):
                        continue
                    partner = resolve_partner(entry.get("partner_name") or "")
                    if partner is None:
                        skipped["prices"] += 1
                        continue
                    item = resolve_item(partner, entry.get("item_name") or "")
                    if item is None:
                        skipped["prices"] += 1
                        continue
                    ymd = entry.get("effective_from") or ""
                    if not ymd:
                        skipped["prices"] += 1
                        continue
                    if PartnerPrice.objects.filter(
                        partner_id=partner.id, item_id=item.id, effective_from=ymd,
                    ).exists():
                        skipped["prices"] += 1
                        continue
                    sale = _to_decimal(entry.get("sale_price"))
                    purchase = _to_decimal(entry.get("purchase_price"))
                    try:
                        with transaction.atomic():
                            pr = PartnerPrice.objects.create(
                                partner=partner, item=item,
                                sale_price=sale, purchase_price=purchase,
                                effective_from=ymd,
                                memo="PO 변환기 자동 등록",
                            )
                        created_prices.append({
                            "id": pr.id, "partner_id": partner.id,
                            "item_id": item.id, "sale_price": str(sale),
                            "effective_from": ymd,
                        })
                    except IntegrityError:
                        skipped["prices"] += 1

                # ─── 4. 출고전표 ─────────────────────────
                for entry in orders_in:
                    if not isinstance(entry, dict):
                        continue
                    partner = resolve_partner(entry.get("partner_name") or "")
                    if partner is None:
                        skipped["orders"] += 1
                        continue
                    order_date = entry.get("order_date") or ""
                    if not order_date:
                        skipped["orders"] += 1
                        continue
                    raw_lines = entry.get("lines") or []
                    if not raw_lines:
                        skipped["orders"] += 1
                        continue

                    vat_type = entry.get("vat_type") or partner.vat_type or "none"
                    tax_type = entry.get("tax_type") or "exempt"

                    # 라인 사전 검증 — item 모두 해결 가능해야 전표 생성
                    resolved_lines: list[tuple[Item, dict]] = []
                    all_ok = True
                    for ln in raw_lines:
                        if not isinstance(ln, dict):
                            continue
                        item = resolve_item(partner, ln.get("item_name") or "")
                        if item is None:
                            all_ok = False
                            break
                        resolved_lines.append((item, ln))
                    if not all_ok or not resolved_lines:
                        skipped["orders"] += 1
                        continue

                    # ── 중복 출고전표 검사 ──
                    # 같은 (partner, date)의 기존 전표를 모두 가져와 라인 시그니처 비교.
                    # 시그니처: 정렬된 "item_id:qty:unit_price" 리스트.
                    incoming_sig = sorted(
                        f"{item.id}:{_to_decimal(ln.get('qty'))}:{_to_decimal(ln.get('unit_price'))}"
                        for (item, ln) in resolved_lines
                    )
                    existing_orders = DeliveryOrder.objects.filter(
                        company_id=company.id, partner_id=partner.id,
                        order_date=order_date,
                    ).prefetch_related("lines")
                    is_dup = False
                    for eo in existing_orders:
                        eo_sig = sorted(
                            f"{ln.item_id}:{ln.qty}:{ln.unit_price}"
                            for ln in eo.lines.all()
                        )
                        if eo_sig == incoming_sig:
                            is_dup = True
                            break
                    if is_dup:
                        skipped["orders"] += 1
                        continue

                    order_no = DeliveryOrder.generate_order_no(
                        company.id, _to_date(order_date),
                    )
                    order = DeliveryOrder.objects.create(
                        company_id=company.id, partner=partner,
                        order_no=order_no, order_date=order_date,
                        vat_type=vat_type, tax_type=tax_type,
                        status="confirmed",
                        note=entry.get("note") or "PO 변환기 자동 등록",
                    )
                    for (item, ln) in resolved_lines:
                        line = DeliveryLine(
                            order=order, item=item,
                            spec=ln.get("spec") or item.spec or "",
                            unit=ln.get("unit") or item.unit_out or "kg",
                            qty=_to_decimal(ln.get("qty")),
                            unit_price=_to_decimal(ln.get("unit_price")),
                        )
                        line.compute(vat_type)
                        line.save()
                    order.recompute_totals()
                    created_orders.append({
                        "id": order.id, "order_no": order.order_no,
                        "partner_id": partner.id, "partner_name": partner.name,
                        "lines": len(resolved_lines), "total": str(order.total),
                    })

        except Exception as e:
            return Response(
                {"detail": f"등록 중 오류 — 전체 롤백: {e}"},
                status=500,
            )

        return Response({
            "created": {
                "partners": len(created_partners),
                "items": len(created_items),
                "prices": len(created_prices),
                "orders": len(created_orders),
            },
            "skipped": skipped,
            "partners": created_partners,
            "items": created_items,
            "prices": created_prices,
            "orders": created_orders,
        }, status=201)


def _to_date(s: str):
    """YYYY-MM-DD 문자열을 date 객체로. 실패하면 None."""
    try:
        y, m, d = s.split("-")
        return date_cls(int(y), int(m), int(d))
    except Exception:
        return None


class DownloadView(APIView):
    """GET /api/convert/download/<id>  — one-shot xlsx download.

    Not auth-gated: the UUID itself is the capability and it's popped on use.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, download_id: str):
        item = _DOWNLOADS.pop(download_id, None)
        if not item:
            raise Http404("download expired or unknown")
        data, name = item
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        tmp.write(data)
        tmp.flush()
        tmp.close()
        return FileResponse(
            open(tmp.name, "rb"),
            as_attachment=True,
            filename=name,
            content_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )
