from rest_framework.routers import DefaultRouter

from .views import DeliveryOrderViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"delivery", DeliveryOrderViewSet, basename="delivery")

urlpatterns = router.urls
