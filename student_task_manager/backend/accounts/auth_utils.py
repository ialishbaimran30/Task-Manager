from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken


def generate_unique_username(email):
    base_username = email.split("@")[0]
    username = base_username
    suffix = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{suffix}"
        suffix += 1
    return username


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "username": user.username,
        "email": user.email,
        "user_id": user.id,
    }
