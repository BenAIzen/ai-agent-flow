from rest_framework import viewsets

from apps.companies.mixins import CompanyScopedMixin, DateRangeFilterMixin

from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(DateRangeFilterMixin, CompanyScopedMixin,
                     viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related("partner").all()

    # DateRangeFilterMixin 설정
    date_field = "payment_date"
    search_fields = ["payment_no", "note"]
