from django.contrib import admin

from .models import InvoiceSetting


@admin.register(InvoiceSetting)
class InvoiceSettingAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "print_form", "show_vat",
                    "show_receivable", "updated_at")
    list_filter = ("company", "print_form", "show_vat", "show_receivable")
    autocomplete_fields = ("user", "company")
