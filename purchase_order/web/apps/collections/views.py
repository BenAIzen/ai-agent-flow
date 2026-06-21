from rest_framework import viewsets

from apps.companies.mixins import CompanyScopedMixin, DateRangeFilterMixin

from .models import Collection
from .serializers import CollectionSerializer


class CollectionViewSet(DateRangeFilterMixin, CompanyScopedMixin,
                        viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    queryset = Collection.objects.select_related("partner").all()

    # DateRangeFilterMixin 설정
    date_field = "receipt_date"
    search_fields = ["receipt_no", "note"]
