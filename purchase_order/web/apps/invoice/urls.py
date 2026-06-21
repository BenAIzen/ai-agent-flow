from django.urls import path

from .views import InvoicePreviewView, InvoiceSettingView

urlpatterns = [
    path("invoice/setting", InvoiceSettingView.as_view(), name="invoice-setting"),
    path("invoice/preview", InvoicePreviewView.as_view(), name="invoice-preview"),
]
