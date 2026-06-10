"""Django settings — GreenFood ERP.

Local dev defaults are baked in here. Override via environment in production:
    DJANGO_SECRET_KEY, DJANGO_DEBUG, DATABASE_URL_*, etc.
"""

from datetime import timedelta
from pathlib import Path

import os

import pymysql

pymysql.install_as_MySQLdb()  # avoid mysqlclient native build on Windows


BASE_DIR = Path(__file__).resolve().parent.parent


# Minimal .env loader — avoids a python-dotenv dependency for one tiny task.
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)

SECRET_KEY = _env("DJANGO_SECRET_KEY", "dev-only-do-not-use-in-prod-please")
DEBUG = _env("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"] if DEBUG else _env("DJANGO_ALLOWED_HOSTS", "").split(",")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "rest_framework_simplejwt",
    "simple_history",
    "import_export",

    "apps.accounts",
    "apps.companies",
    "apps.converter",
    "apps.partners",
    "apps.items",
    "apps.prices",
    "apps.delivery",
    "apps.collections",
    "apps.payments",
    "apps.invoice",
    "apps.ledger",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
]

ROOT_URLCONF = "greenfood.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "greenfood.wsgi.application"

# MySQL via PyMySQL (no native build on Windows).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME":     _env("MYSQL_DATABASE", "greenfood"),
        "USER":     _env("MYSQL_USER", "greenfood"),
        "PASSWORD": _env("MYSQL_PASSWORD", "greenfoodpass"),
        "HOST":     _env("MYSQL_HOST", "127.0.0.1"),
        "PORT":     _env("MYSQL_PORT", "3307"),
        "OPTIONS": {"charset": "utf8mb4"},
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "ko-kr"
TIME_ZONE = "Asia/Seoul"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---- DRF ----
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}
