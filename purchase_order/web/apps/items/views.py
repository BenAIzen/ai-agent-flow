from django.db import IntegrityError, transaction
from django.db.models import ProtectedError, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.companies.mixins import CompanyScopedMixin, get_request_company
from apps.partners.models import Partner
from apps.partners.views import next_partner_code, normalize_partner_name

from .models import Item
from .serializers import ItemSerializer


def next_item_code(company_id: int) -> str:
    """회사 내 다음 품목 코드(3자리 0패딩) 채번.

    숫자형 코드 중 최대값 + 1. 비숫자 코드(legacy)는 무시.
    """
    rows = Item.objects.filter(company_id=company_id).values_list("code", flat=True)
    max_n = 0
    for c in rows:
        if c and c.isdigit():
            n = int(c)
            if n > max_n:
                max_n = n
    return f"{max_n + 1:03d}"


def normalize_item_name(name: str) -> str:
    """이름 매칭용 정규화: 공백 압축, 양끝 공백 제거. 대소문자는 보존."""
    return " ".join((name or "").split())


def resolve_or_create_partner(
    company_id: int, partner_id: int | None, partner_name: str | None,
) -> tuple[Partner | None, bool]:
    """거래처 ID 우선, 없으면 이름으로 정규화 매칭, 없으면 신규 생성.

    Returns:
        (partner, was_created). partner는 ID/name 둘 다 없으면 None.
    """
    if partner_id:
        try:
            return Partner.objects.get(pk=partner_id, company_id=company_id), False
        except Partner.DoesNotExist:
            pass

    norm = normalize_partner_name(partner_name or "")
    if not norm:
        return None, False

    # 정규화 이름이 동일한 거래처 (활성 + 비활성 모두 매칭)
    existing = Partner.objects.filter(company_id=company_id, name=norm).first()
    if existing:
        return existing, False

    # 신규 생성. biz_class는 일단 매출처(customer)로 기본 설정 — 발주서 받는
    # 쪽이니까. 사용자가 거래처관리에서 나중에 vendor로도 바꿀 수 있음.
    try:
        with transaction.atomic():
            partner = Partner.objects.create(
                company_id=company_id,
                code=next_partner_code(company_id),
                name=norm,
                biz_class="customer",
            )
        return partner, True
    except IntegrityError:
        # race
        existing = Partner.objects.filter(company_id=company_id, name=norm).first()
        return existing, False


class ItemViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    queryset = Item.objects.select_related("partner").all()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action != "list":
            return qs
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q)
                           | Q(spec__icontains=q)
                           | Q(partner__name__icontains=q))
        partner_id = self.request.query_params.get("partner")
        if partner_id:
            qs = qs.filter(partner_id=partner_id)
        if self.request.query_params.get("active", "1") in ("1", "true"):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        """수동 추가: 사용자가 보낸 code 그대로 사용.
        code가 비어 있으면(PO bulk-create는 별도 action으로 처리되지만, 일반
        POST에서도 빈 코드 보내는 케이스 대비) 자동 채번.
        """
        company = get_request_company(self.request)
        kwargs: dict = {"company": company}
        if not serializer.validated_data.get("code"):
            kwargs["code"] = next_item_code(company.id)
        serializer.save(**kwargs)

    def destroy(self, request, *args, **kwargs):
        """Hard delete. 출고전표 등 PROTECT FK가 있으면 409 반환.

        PartnerPrice는 CASCADE 라 자동 삭제, DeliveryLine 등은 PROTECT.
        FK가 막으면 사용자에게 명확한 이유 + 어디서 막혔는지 알려줌.
        """
        item = self.get_object()
        try:
            item.delete()
        except ProtectedError as e:
            # 어디서 막혔는지 추출 (예: "출고 라인 3건")
            blocked_by: dict[str, int] = {}
            for obj in e.protected_objects:
                model_name = obj._meta.verbose_name
                blocked_by[model_name] = blocked_by.get(model_name, 0) + 1
            detail = ", ".join(f"{name} {cnt}건" for name, cnt in blocked_by.items())
            return Response(
                {
                    "detail": (
                        f"이 품목은 거래 내역이 있어 삭제할 수 없습니다 ({detail}). "
                        "거래를 먼저 정리하거나 사용 중지가 필요하면 관리자에게 문의하세요."
                    ),
                    "blocked_by": blocked_by,
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        """일괄 품목 생성 (PO 변환기 후보 확정용).

        Body: {
          "items": [
            {"partner_id": 123, "name": "...", "unit": "kg"},
            {"partner_name": "(주)강남포포인츠", "name": "양배추", "unit": "kg"},
            ...
          ]
        }

        Response:
          {
            "created_items": N,
            "skipped_existing": M,
            "created_partners": K,
            "items": [...],
            "partners": [...]
          }

        - partner_id 우선, 없으면 partner_name으로 정규화 매칭
        - 거래처 없으면 자동 생성 (biz_class=customer)
        - (회사, 거래처, 정규화품명) 중복이면 skip
        - 비숫자 코드 무시한 채번
        - 동시성: IntegrityError 캐치로 race 흡수
        """
        company = get_request_company(request)
        items_input = request.data.get("items") or []
        if not isinstance(items_input, list):
            return Response({"detail": "items must be a list"}, status=400)

        # 회사의 기존 (partner_id, 정규화 이름) 인덱스 — 중복 검사용
        existing_keys: set[tuple[int | None, str]] = {
            (pid, normalize_item_name(n))
            for pid, n in Item.objects.filter(
                company_id=company.id,
            ).values_list("partner_id", "name")
        }

        created_items: list[dict] = []
        created_partners_map: dict[int, dict] = {}  # id → 응답용
        skipped = 0
        seen_in_batch: set[tuple[int | None, str]] = set()

        for entry in items_input:
            if not isinstance(entry, dict):
                continue
            name = normalize_item_name(entry.get("name") or "")
            if not name:
                continue

            partner, was_new = resolve_or_create_partner(
                company.id,
                entry.get("partner_id"),
                entry.get("partner_name"),
            )
            if partner is None:
                # 거래처 없이는 생성 불가 (정책)
                skipped += 1
                continue

            if was_new and partner.id not in created_partners_map:
                created_partners_map[partner.id] = {
                    "id": partner.id, "code": partner.code, "name": partner.name,
                }

            key = (partner.id, name)
            if key in existing_keys or key in seen_in_batch:
                skipped += 1
                continue

            unit = (entry.get("unit") or "kg").strip() or "kg"

            try:
                with transaction.atomic():
                    obj = Item.objects.create(
                        company_id=company.id,
                        partner=partner,
                        code=next_item_code(company.id),
                        name=name,
                        unit_in=unit, unit_out=unit, unit_stock=unit,
                    )
                seen_in_batch.add(key)
                created_items.append({
                    "id": obj.id, "code": obj.code,
                    "name": obj.name, "unit_out": obj.unit_out,
                    "partner_id": partner.id, "partner_name": partner.name,
                })
            except IntegrityError:
                skipped += 1
                seen_in_batch.add(key)

        return Response({
            "created_items": len(created_items),
            "skipped_existing": skipped,
            "created_partners": len(created_partners_map),
            "items": created_items,
            "partners": list(created_partners_map.values()),
        }, status=201 if created_items or created_partners_map else 200)
