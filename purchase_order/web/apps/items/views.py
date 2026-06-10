from django.db.models import Q
from rest_framework import viewsets

from apps.companies.mixins import CompanyScopedMixin

from .models import Item
from .serializers import ItemSerializer


class ItemViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    queryset = Item.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q)
                           | Q(spec__icontains=q))
        if self.request.query_params.get("active", "1") in ("1", "true"):
            qs = qs.filter(is_active=True)
        return qs
