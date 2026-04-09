from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import get_async_session_context
from app.jobs.celery_app import celery_app
from app.models.enums import BroadcastStatus
from app.models.request import ReportRequest, RequestBroadcast


@celery_app.task(name="app.jobs.broadcast_tasks.check_broadcast_rounds")
def check_broadcast_rounds():
    """Every 5 min: expire overdue broadcasts and start next round."""
    import asyncio
    asyncio.run(_check_rounds())


async def _check_rounds():
    async with get_async_session_context() as db:
        now = datetime.now(timezone.utc)

        result = await db.execute(
            select(RequestBroadcast).where(
                RequestBroadcast.status == BroadcastStatus.ACTIVE,
                RequestBroadcast.accept_deadline < now,
            )
        )
        expired_broadcasts = list(result.scalars().all())

        for broadcast in expired_broadcasts:
            req_result = await db.execute(
                select(ReportRequest).where(
                    ReportRequest.id == broadcast.request_id
                )
            )
            request = req_result.scalar_one_or_none()
            if not request:
                continue

            from app.services import broadcast_service
            await broadcast_service.advance_broadcast_round(
                db, request=request, current_broadcast=broadcast,
            )
