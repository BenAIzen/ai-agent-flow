from rest_framework.routers import DefaultRouter

from .views import PartnerPriceViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"prices", PartnerPriceViewSet, basename="price")

urlpatterns = router.urls
