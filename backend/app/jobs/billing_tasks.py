import asyncio
from datetime import datetime, timedelta
from celery import shared_task
from app.core.database import get_async_session_context


@shared_task(
    name="app.jobs.billing_tasks.generate_monthly_invoices",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_monthly_invoices(self):
    try:
        asyncio.run(_generate())
    except Exception as exc:
        self.retry(exc=exc)


async def _generate():
    from app.services import billing_service

    now = datetime.utcnow()
    first_of_month = now.replace(day=1)
    prev_month = first_of_month - timedelta(days=1)
    month = prev_month.strftime("%Y-%m")

    async with get_async_session_context() as db:
        invoices = await billing_service.generate_invoices_for_month(db, month)

        if invoices:
            from app.services.notification_service import create_notification
            from app.services.activity_log_service import log_activity
            from app.models.enums import (
                NotificationEventType,
                NotificationReferenceType,
            )
            from app.models.user import User
            from sqlalchemy import select

            for invoice in invoices:
                await log_activity(
                    db,
                    actor_id=None,
                    actor_type="SYSTEM",
                    action="INVOICE_GENERATED",
                    target_type="INVOICE",
                    target_id=invoice.id,
                    metadata={
                        "invoice_number": invoice.invoice_number,
                        "amount": str(invoice.amount),
                        "month": invoice.month,
                        "type": invoice.invoice_type.value,
                    },
                )

                users_result = await db.execute(
                    select(User).where(User.organization_id == invoice.organization_id)
                )
                for user in users_result.scalars().all():
                    await create_notification(
                        db,
                        user_id=user.id,
                        event_type=NotificationEventType.INVOICE_GENERATED,
                        title="Invoice Generated",
                        message=f"Your invoice for {invoice.month} has been generated: {invoice.invoice_number}, Amount: \u20b9{invoice.amount}",
                        reference_id=invoice.id,
                        reference_type=NotificationReferenceType.INVOICE,
                    )
