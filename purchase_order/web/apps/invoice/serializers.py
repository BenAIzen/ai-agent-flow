from rest_framework import serializers

from .models import InvoiceSetting


class InvoiceSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceSetting
        exclude = ("user", "company", "updated_at")
