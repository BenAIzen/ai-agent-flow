from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import PartnerPrice


@admin.register(PartnerPrice)
class PartnerPriceAdmin(SimpleHistoryAdmin):
    list_display = ("partner", "item", "sale_price", "purchase_price",
                    "effective_from", "is_active")
    list_filter = ("is_active", "effective_from")
    search_fields = ("partner__name", "partner__code",
                     "item__name", "item__code")
    autocomplete_fields = ("partner", "item")
    date_hierarchy = "effective_from"
