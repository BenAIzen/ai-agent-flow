from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Item


@admin.register(Item)
class ItemAdmin(SimpleHistoryAdmin):
    list_display = ("code", "name", "spec", "company", "procure_type",
                    "account_type", "unit_out", "standard_cost", "is_active")
    list_filter = ("company", "procure_type", "account_type", "is_active")
    search_fields = ("code", "name", "spec", "invoice_print_name")
    autocomplete_fields = ("company",)
    list_editable = ("is_active",)
    fieldsets = (
        (None, {"fields": ("company", "code", "name", "spec", "is_active")}),
        ("분류", {"fields": ("procure_type", "account_type")}),
        ("단위", {"fields": ("unit_in", "unit_out", "unit_stock")}),
        ("단가/출력", {"fields": ("standard_cost", "invoice_print_name")}),
        ("기타", {"fields": ("memo",)}),
    )
