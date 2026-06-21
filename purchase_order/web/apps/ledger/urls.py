from django.urls import path

from .views import PayableView, ReceivableView

urlpatterns = [
    path("ledger/receivable", ReceivableView.as_view(), name="ledger-receivable"),
    path("ledger/payable", PayableView.as_view(), name="ledger-payable"),
]
