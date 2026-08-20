"""
ASGI config for student_task_manager project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import logging
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_task_manager.settings')

from django.core.asgi import get_asgi_application
from django.core.management import call_command

logger = logging.getLogger(__name__)

# get_asgi_application() runs django.setup(), populating the app registry.
django_asgi_app = get_asgi_application()

# Auto-migration on boot. Broad except is intentional here: a migration
# failure (e.g. transient DB connectivity at cold start) must not prevent
# the ASGI app itself from coming up, or Azure's health probe never gets
# a response at all and the whole container gets marked unhealthy again.
try:
    call_command('migrate', interactive=False)
except Exception:
    logger.exception("Auto-migration failed during startup")

# These imports must come after get_asgi_application() (which runs
# django.setup()): tasks.jwt_middleware imports django.contrib.auth.models,
# which needs the app registry populated first. Splitting the import block
# here is required, not an oversight — see the ASGI-crash fix earlier in
# this file's history for what happens if these move above the line above.
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: I001
from tasks.jwt_middleware import JWTAuthMiddleware
import tasks.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(tasks.routing.websocket_urlpatterns)
    ),
})