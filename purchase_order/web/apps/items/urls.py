from rest_framework.routers import DefaultRouter

from .views import ItemViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"items", ItemViewSet, basename="item")

urlpatterns = router.urls
