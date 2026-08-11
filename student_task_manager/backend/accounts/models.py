from django.contrib.auth.models import User
from django.db import models


class GoogleProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="google_profile")
    google_id = models.CharField(max_length=255, unique=True)
    profile_picture = models.URLField(blank=True, null=True)
    auth_provider = models.CharField(max_length=20, default="google")

    def __str__(self):
        return f"{self.user.username} ({self.auth_provider})"


class OTP(models.Model):
    PURPOSE_CHOICES = [("login", "Login"), ("signup", "Signup")]

    email = models.EmailField(db_index=True)
    purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES)
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["email", "purpose", "is_used"])]

    def __str__(self):
        return f"{self.email} ({self.purpose})"