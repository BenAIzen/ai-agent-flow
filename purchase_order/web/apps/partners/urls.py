from rest_framework.routers import DefaultRouter

from .views import PartnerViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"partners", PartnerViewSet, basename="partner")

urlpatterns = router.urls
