"""Idempotent seeder: admin user + default company.

Run with:  python manage.py seed_initial
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import UserCompany
from apps.companies.models import Company


class Command(BaseCommand):
    help = "Create admin/admin1234 + (주)그린푸드 if they do not exist."

    def handle(self, *args, **options):
        User = get_user_model()

        default_company, c_created = Company.objects.get_or_create(
            name="(주)그린푸드",
            defaults={"biz_type": "법인", "is_default": True},
        )
        if c_created:
            self.stdout.write(self.style.SUCCESS(
                f"+ company  {default_company.name}"))

        if User.objects.filter(username="admin").exists():
            self.stdout.write("admin user already exists — skipping")
        else:
            admin = User.objects.create_superuser(
                username="admin",
                password="admin1234",
                display_name="Admin",
            )
            admin.default_company = default_company
            admin.save(update_fields=["default_company"])
            UserCompany.objects.create(
                user=admin, company=default_company, role="admin"
            )
            self.stdout.write(self.style.SUCCESS(
                "+ user     admin / admin1234 (superuser)"))
