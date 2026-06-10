from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Partner, PartnerAccount


class PartnerAccountInline(admin.TabularInline):
    model = PartnerAccount
    extra = 0
    fields = ("bank", "account_no", "holder", "nickname", "is_default", "is_active")


@admin.register(Partner)
class PartnerAdmin(SimpleHistoryAdmin):
    list_display = (
        "code", "name", "company", "biz_class",
        "biz_no", "rep_name", "vat_type", "is_active",
    )
    list_filter = ("company", "biz_class", "vat_type", "is_active")
    search_fields = ("code", "name", "biz_no", "rep_name", "output_name")
    autocomplete_fields = ("company",)
    list_editable = ("is_active",)
    inlines = [PartnerAccountInline]
    fieldsets = (
        (None, {"fields": ("company", "code", "name", "biz_class", "is_active")}),
        ("사업자정보", {"fields": ("biz_no", "rep_name", "biz_kind", "biz_item")}),
        ("연락처",     {"fields": ("address", "tel", "fax", "email")}),
        ("출고/세금",  {"fields": ("vat_type", "output_name")}),
        ("기타",       {"fields": ("memo",)}),
    )


@admin.register(PartnerAccount)
class PartnerAccountAdmin(SimpleHistoryAdmin):
    list_display = ("partner", "bank", "account_no", "holder",
                    "nickname", "is_default", "is_active")
    list_filter = ("bank", "is_default", "is_active")
    search_fields = ("partner__name", "partner__code", "account_no", "holder")
    autocomplete_fields = ("partner",)
