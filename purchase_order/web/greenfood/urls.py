"""URL configuration.

API 라우터는 모두 /api/ 아래. 나머지 모든 경로는 React SPA로 보냄
(history routing이라 /main, /login 등 모든 URL을 index.html에서 처리).
"""

from pathlib import Path

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path

BASE_DIR = Path(__file__).resolve().parent.parent
SPA_INDEX = BASE_DIR / "static" / "dist" / "index.html"


def spa_index(request):
    """React SPA 진입점.

    /api/, /admin/, /static/ 을 제외한 모든 경로가 여기로 들어와
    React Router가 클라이언트 라우팅 처리.
    """
    html = SPA_INDEX.read_text(encoding="utf-8")
    return HttpResponse(html, content_type="text/html; charset=utf-8")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.companies.urls")),
    path("api/", include("apps.converter.urls")),
    path("api/", include("apps.partners.urls")),
    path("api/", include("apps.items.urls")),
    path("api/", include("apps.prices.urls")),
    path("api/", include("apps.delivery.urls")),
    path("api/", include("apps.collections.urls")),
    path("api/", include("apps.payments.urls")),
    path("api/", include("apps.invoice.urls")),
    path("api/", include("apps.ledger.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=BASE_DIR / "static")

# SPA fallback: /api/, /admin/, /static/ 을 제외한 모든 URL을 index.html로
urlpatterns += [
    re_path(r"^(?!api/|admin/|static/).*$", spa_index, name="spa-index"),
]
