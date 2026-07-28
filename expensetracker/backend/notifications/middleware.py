from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token_key):
    try:
        access_token = AccessToken(token_key)
        user_id = access_token["user_id"]
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # 1. Query string parsing using urllib (handles encoded characters safely)
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        
        # 2. Extract token safely
        token_list = query_params.get("token", None)
        token = token_list[0] if token_list else None

        # 3. Authenticate User
        if token:
            scope["user"] = await get_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)

# Alias to avoid ImportError in asgi.py
JWTAuthMiddleware = TokenAuthMiddleware