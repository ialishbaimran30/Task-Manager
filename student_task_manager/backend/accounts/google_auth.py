from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from django.conf import settings


def verify_google_token(token):
    """Verify a Google ID token and return its payload, or None if invalid."""
    try:
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        if idinfo.get("aud") != settings.GOOGLE_CLIENT_ID:
            return None
        return idinfo
    except ValueError:
        return None