from rest_framework.routers import DefaultRouter

from .views import CompanyViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"companies", CompanyViewSet, basename="company")

urlpatterns = router.urls
