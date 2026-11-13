from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def build_reset_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"


def send_password_reset_email(user):
    link = build_reset_link(user)
    name = user.first_name or "there"
    send_mail(
        "Reset your ThermaTrust password",
        (
            f"Hi {name},\n\n"
            "We received a request to reset your ThermaTrust password. "
            f"Use this link to choose a new one:\n\n{link}\n\n"
            "The link works once and expires after a short time. "
            "If you did not ask for this, you can ignore this email.\n"
        ),
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )
