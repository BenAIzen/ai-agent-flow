from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, UserCompany


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("그린푸드", {"fields": ("display_name", "default_company")}),
    )
    list_display = (
        "username", "display_name", "default_company", "is_staff", "is_active",
    )


@admin.register(UserCompany)
class UserCompanyAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "company__name")
    autocomplete_fields = ("user", "company")
