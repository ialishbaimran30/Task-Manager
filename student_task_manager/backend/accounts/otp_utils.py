import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.utils import timezone

from .models import OTP


def generate_code():
    return f"{secrets.randbelow(900000) + 100000}"


def create_and_send_otp(email, purpose):
    code = generate_code()
    otp = OTP.objects.create(
        email=email,
        purpose=purpose,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
    )
    try:
        send_mail(
            subject="Your verification code",
            message=f"Your verification code is {code}. It expires in {settings.OTP_EXPIRY_MINUTES} minutes.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )
    except Exception:
        otp.delete()
        raise
    return otp


def seconds_until_resend_allowed(email, purpose):
    last = OTP.objects.filter(email=email, purpose=purpose).order_by("-created_at").first()
    if not last:
        return 0
    elapsed = (timezone.now() - last.created_at).total_seconds()
    remaining = settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed
    return max(0, int(remaining))
