from django.db.models import Q
from rest_framework import viewsets

from apps.companies.mixins import CompanyScopedMixin

from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related("partner").all()

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        partner = self.request.query_params.get("partner")
        q = self.request.query_params.get("q")
        if date_from:
            qs = qs.filter(payment_date__gte=date_from)
        if date_to:
            qs = qs.filter(payment_date__lte=date_to)
        if partner:
            qs = qs.filter(partner_id=partner)
        if q:
            qs = qs.filter(Q(payment_no__icontains=q) | Q(partner__name__icontains=q)
                           | Q(note__icontains=q))
        return qs
