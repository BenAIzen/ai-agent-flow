from django.apps import AppConfig


class PricesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.prices"
    label = "prices"
    verbose_name = "거래처별 단가"
