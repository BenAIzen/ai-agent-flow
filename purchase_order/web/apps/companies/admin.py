from django.contrib import admin

from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "biz_type", "biz_no", "rep_name", "is_default", "is_active")
    list_filter = ("biz_type", "is_default", "is_active")
    search_fields = ("name", "biz_no", "rep_name")
    list_editable = ("is_default", "is_active")
