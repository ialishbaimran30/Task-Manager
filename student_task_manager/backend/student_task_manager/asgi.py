"""
ASGI config for student_task_manager project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_task_manager.settings')

from django.core.asgi import get_asgi_application

# get_asgi_application() runs django.setup(), populating the app registry.
django_asgi_app = get_asgi_application()

# Safe auto-migration execution on application boot
try:
    call_command('migrate', interactive=False)
except Exception as e:
    print(f"Auto-migration failed during startup: {e}")

from channels.routing import ProtocolTypeRouter, URLRouter
from tasks.jwt_middleware import JWTAuthMiddleware
import tasks.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(tasks.routing.websocket_urlpatterns)
    ),
})