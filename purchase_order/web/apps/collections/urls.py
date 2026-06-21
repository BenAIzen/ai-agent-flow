from rest_framework.routers import DefaultRouter

from .views import CollectionViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"collections", CollectionViewSet, basename="collection")

urlpatterns = router.urls
