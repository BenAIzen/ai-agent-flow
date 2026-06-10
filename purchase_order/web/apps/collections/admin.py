from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Collection


@admin.register(Collection)
class CollectionAdmin(SimpleHistoryAdmin):
    list_display = ("receipt_no", "receipt_date", "company", "partner",
                    "receipt_type", "amount")
    list_filter = ("company", "receipt_type", "receipt_date")
    search_fields = ("receipt_no", "partner__name", "partner__code", "note")
    autocomplete_fields = ("company", "partner", "bank_account")
    date_hierarchy = "receipt_date"
    readonly_fields = ("receipt_no", "created_at", "updated_at")
