from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(SimpleHistoryAdmin):
    list_display = ("payment_no", "payment_date", "company", "partner",
                    "payment_type", "amount")
    list_filter = ("company", "payment_type", "payment_date")
    search_fields = ("payment_no", "partner__name", "partner__code", "note")
    autocomplete_fields = ("company", "partner", "bank_account")
    date_hierarchy = "payment_date"
    readonly_fields = ("payment_no", "created_at", "updated_at")
