from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# Fail closed: a missing DEBUG flag must never silently expose a production instance.
DEBUG = config("DEBUG", default=False, cast=bool)
SECRET_KEY = config("SECRET_KEY", default="django-insecure-local-development-only")
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

if not DEBUG:
    if len(SECRET_KEY) < 50 or SECRET_KEY.startswith(("django-insecure-", "change-me", "dev-")):
        raise RuntimeError("Set SECRET_KEY to a unique random value of at least 50 characters in production.")
    if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
        raise RuntimeError("Set ALLOWED_HOSTS to the exact production hostnames; wildcards are not allowed.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    # local apps
    "apps.accounts",
    "apps.core",
    "apps.facilities",
    "apps.contractors",
    "apps.technicians",
    "apps.jobs",
    "apps.servicereports",
    "apps.assessments",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="hvacr"),
        "USER": config("DB_USER", default="hvacr"),
        "PASSWORD": config("DB_PASSWORD", default="hvacr"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

# Hosted Postgres (Supabase, Neon, ...) hands out one connection URL instead of
# separate fields; when it is set it replaces the DB_* values above.
DATABASE_URL = config("DATABASE_URL", default="")
if DATABASE_URL:
    _db = urlparse(DATABASE_URL)
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": _db.path.lstrip("/") or "postgres",
        "USER": unquote(_db.username or ""),
        "PASSWORD": unquote(_db.password or ""),
        "HOST": _db.hostname,
        "PORT": _db.port or 5432,
        "OPTIONS": {"sslmode": config("DB_SSLMODE", default="require")},
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = "/media/"
MEDIA_ROOT = config("MEDIA_ROOT", default=str(BASE_DIR / "media"))
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 2000
FILE_UPLOAD_PERMISSIONS = 0o640

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    # Global budgets protect the API; high-cost actions have tighter scoped limits.
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "600/minute",
        "credential_ocr": "30/hour",
        "password_reset": "10/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
}

CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="http://localhost:5173", cast=Csv())
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173")

# Compliance-alert emails. Console backend by default so local dev just prints
# them; set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend plus the
# EMAIL_HOST* values in production to actually deliver.
EMAIL_BACKEND = config("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="ThermaTrust <noreply@thermatrust.local>")
# Shared secret letting a free external scheduler trigger the daily digest
# (the hosting free tier has no cron). Empty disables the endpoint entirely.
ALERTS_CRON_TOKEN = config("ALERTS_CRON_TOKEN", default="")

# AI-assisted credential reading. Off unless a key is set. The model is the
# product owner's call - a cheaper one (e.g. claude-haiku-5-5) is a one-line
# env change if per-scan cost matters more than accuracy on messy photos.
ANTHROPIC_API_KEY = config("ANTHROPIC_API_KEY", default="")
CREDENTIAL_OCR_MODEL = config("CREDENTIAL_OCR_MODEL", default="claude-opus-5-5")

# Browser push alerts (Web Push / VAPID). Off until both keys are set; generate
# a pair with `python manage.py generate_vapid_keys`. The public key is served
# to the app so browsers can subscribe; the private key never leaves the server.
VAPID_PUBLIC_KEY = config("VAPID_PUBLIC_KEY", default="")
VAPID_PRIVATE_KEY = config("VAPID_PRIVATE_KEY", default="")
VAPID_CONTACT = config("VAPID_CONTACT", default="mailto:admin@thermatrust.local")
# Deliver on a background thread so a slow push service can't stall a request.
PUSH_SEND_ASYNC = config("PUSH_SEND_ASYNC", default=True, cast=bool)

if not DEBUG:
    # Render / reverse-proxy deployment defaults. TLS must terminate before Django.
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = 31_536_000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
    if not CORS_ALLOWED_ORIGINS or any(origin == "*" for origin in CORS_ALLOWED_ORIGINS):
        raise RuntimeError("Set CORS_ALLOWED_ORIGINS to explicit trusted frontend origins in production.")
