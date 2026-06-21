from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import DeliveryLine, DeliveryOrder


class DeliveryLineInline(admin.TabularInline):
    model = DeliveryLine
    extra = 0
    autocomplete_fields = ("item",)
    fields = ("item", "spec", "unit", "qty", "unit_price",
              "supply_amount", "vat_amount", "total", "note")
    readonly_fields = ("supply_amount", "vat_amount", "total")


@admin.register(DeliveryOrder)
class DeliveryOrderAdmin(SimpleHistoryAdmin):
    list_display = ("order_no", "order_date", "company", "partner",
                    "vat_type", "status", "total")
    list_filter = ("company", "status", "vat_type", "order_date")
    search_fields = ("order_no", "partner__name", "partner__code", "note")
    autocomplete_fields = ("company", "partner")
    date_hierarchy = "order_date"
    inlines = [DeliveryLineInline]
    readonly_fields = ("order_no", "subtotal", "vat_total", "total",
                       "created_at", "updated_at")
