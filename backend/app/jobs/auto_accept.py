from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.constants import AUTO_ACCEPT_DAYS
from app.core.database import get_async_session_context
from app.jobs.celery_app import celery_app
from app.models.enums import LenderRequestStatus
from app.models.report import Report
from app.models.request import ReportRequest, RequestAcceptance


@celery_app.task(name="app.jobs.auto_accept.auto_accept_reports")
def auto_accept_reports():
    """Daily task: auto-accept reports not reviewed within AUTO_ACCEPT_DAYS."""
    import asyncio
    asyncio.run(_auto_accept())


async def _auto_accept():
    async with get_async_session_context() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(days=AUTO_ACCEPT_DAYS)

        result = await db.execute(
            select(ReportRequest).where(
                ReportRequest.lender_status == LenderRequestStatus.RECEIVED,
                ReportRequest.updated_at < cutoff,
            )
        )
        requests = list(result.scalars().all())

        for req in requests:
            acc_result = await db.execute(
                select(RequestAcceptance).where(
                    RequestAcceptance.request_id == req.id
                )
            )
            acceptance = acc_result.scalar_one_or_none()
            if not acceptance:
                continue

            report_result = await db.execute(
                select(Report).where(
                    Report.vendor_id == acceptance.vendor_id,
                    Report.is_active == True,
                ).order_by(Report.created_at.desc())
            )
            report = report_result.scalars().first()
            if not report:
                continue

            from app.services import request_service
            await request_service.accept_report(
                db, request=req, report=report, vendor_id=acceptance.vendor_id,
            )
