from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "propeval",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    worker_pool="solo",
    task_track_started=True,
    task_acks_late=True,
)

# Celery Beat schedule
celery_app.conf.beat_schedule = {
    "auto-accept-reports": {
        "task": "app.jobs.auto_accept.auto_accept_reports",
        "schedule": crontab(hour=0, minute=0),  # Daily at midnight IST
    },
    "broadcast-rotation": {
        "task": "app.jobs.broadcast_tasks.check_broadcast_rounds",
        "schedule": 300.0,  # Every 5 minutes
    },
    "generate-monthly-invoices": {
        "task": "app.jobs.billing_tasks.generate_monthly_invoices",
        "schedule": crontab(day_of_month=1, hour=2, minute=0),
    },
    "cleanup-orphaned-files": {
        "task": "app.jobs.cleanup_tasks.cleanup_orphaned_files",
        "schedule": crontab(day_of_week=0, hour=3, minute=0),
    },
    "check-tier-demotions": {
        "task": "check_tier_demotions",
        "schedule": crontab(hour=0, minute=30),  # Daily at 00:30 IST
    },
    "send-demotion-warnings": {
        "task": "send_demotion_warnings",
        "schedule": crontab(hour=0, minute=15),  # Daily at 00:15 IST
    },
}

# Auto-discover tasks in app.jobs package
celery_app.autodiscover_tasks(["app.jobs"])
