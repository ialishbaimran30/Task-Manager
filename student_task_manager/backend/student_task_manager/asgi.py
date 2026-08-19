"""
ASGI config for student_task_manager project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_task_manager.settings')

from django.core.asgi import get_asgi_application

# get_asgi_application() runs django.setup(), populating the app registry.
# Anything imported below this line is allowed to touch Django models
# (tasks.jwt_middleware imports django.contrib.auth.models); anything
# imported above it is not. Under `manage.py runserver` this ordering
# doesn't matter because manage.py itself sets DJANGO_SETTINGS_MODULE
# first, but daphne (used directly in the Docker container's CMD) loads
# this module cold, so the order here is load-bearing in production.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from tasks.jwt_middleware import JWTAuthMiddleware
import tasks.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(tasks.routing.websocket_urlpatterns)
    ),
})