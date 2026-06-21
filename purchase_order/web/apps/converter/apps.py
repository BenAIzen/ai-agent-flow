from django.apps import AppConfig


class ConverterConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.converter"
    label = "converter"
    verbose_name = "발주서 변환"
