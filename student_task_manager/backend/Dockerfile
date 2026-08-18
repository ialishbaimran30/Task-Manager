FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# No DB/secrets are required at build time: settings.py has safe
# fallbacks for every env var it reads, so collectstatic works offline.
RUN python manage.py collectstatic --noinput

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Daphne (ASGI) serves both HTTP and the /ws/notifications/ websocket
# route via Django Channels — gunicorn+WSGI can't serve websockets, so
# this replaces the more common gunicorn setup for this project.
CMD daphne -b 0.0.0.0 -p $PORT student_task_manager.asgi:application
