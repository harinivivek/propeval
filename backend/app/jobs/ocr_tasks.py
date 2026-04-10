import asyncio
import logging

from celery import shared_task
from sqlalchemy import select

from app.core.config import settings
from app.core.constants import OCR_BATCH_DELAY_SECONDS
from app.core.database import get_async_session_context
from app.models.bulk_upload import BulkUploadJob
from app.models.enums import BulkUploadStatus, ReportStatus
from app.models.report import Report

logger = logging.getLogger(__name__)


def _get_ocr_service():
    """Create OCR service with Claude provider (lazy init)."""
    import anthropic
    from app.services.ocr import ClaudeOcrProvider, OcrService

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    provider = ClaudeOcrProvider(client=client, model=settings.OCR_MODEL)
    return OcrService(provider=provider)


@shared_task(
    name="app.jobs.ocr_tasks.process_report_ocr",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    soft_time_limit=settings.OCR_TASK_TIMEOUT,
)
def process_report_ocr(self, report_id: str):
    """Process a single report through OCR extraction."""

    async def _run():
        service = _get_ocr_service()
        async with get_async_session_context() as db:
            result = await db.execute(
                select(Report).where(Report.id == report_id)
            )
            report = result.scalar_one_or_none()
            if not report:
                logger.error("Report %s not found", report_id)
                return

            if report.status not in (ReportStatus.UPLOADED, ReportStatus.EXTRACTION_FAILED):
                logger.info("Report %s status is %s, skipping", report_id, report.status)
                return

            # Optimize PDF before OCR
            from app.jobs.pdf_optimize import optimize_pdf
            if report.uploaded_file_path:
                optimize_pdf(report.uploaded_file_path)

            await service.process_report(db, report)
            logger.info("OCR complete for report %s: %s", report_id, report.status)

    try:
        asyncio.run(_run())
    except Exception as exc:
        logger.exception("OCR task failed for report %s", report_id)
        raise self.retry(exc=exc)


@shared_task(name="app.jobs.ocr_tasks.process_bulk_upload")
def process_bulk_upload(job_id: str, report_ids: list[str]):
    """Process a batch of reports for bulk upload."""

    async def _run():
        service = _get_ocr_service()
        batch_size = settings.OCR_BATCH_SIZE
        processed = 0
        failed = 0

        # Mark job as in progress
        async with get_async_session_context() as db:
            result = await db.execute(
                select(BulkUploadJob).where(BulkUploadJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                logger.error("BulkUploadJob %s not found", job_id)
                return
            job.status = BulkUploadStatus.IN_PROGRESS

        # Process in batches
        for i in range(0, len(report_ids), batch_size):
            batch = report_ids[i : i + batch_size]

            for rid in batch:
                async with get_async_session_context() as db:
                    result = await db.execute(
                        select(Report).where(Report.id == rid)
                    )
                    report = result.scalar_one_or_none()
                    if not report:
                        failed += 1
                        continue

                    try:
                        await service.process_report(db, report)
                        processed += 1
                    except Exception:
                        logger.exception("Bulk OCR failed for report %s", rid)
                        failed += 1

            # Update job progress after each batch
            async with get_async_session_context() as db:
                result = await db.execute(
                    select(BulkUploadJob).where(BulkUploadJob.id == job_id)
                )
                job = result.scalar_one_or_none()
                if job:
                    job.processed_count = processed
                    job.failed_count = failed

            # Delay between batches for rate limiting
            if i + batch_size < len(report_ids):
                await asyncio.sleep(OCR_BATCH_DELAY_SECONDS)

        # Final status
        async with get_async_session_context() as db:
            result = await db.execute(
                select(BulkUploadJob).where(BulkUploadJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            if job:
                job.processed_count = processed
                job.failed_count = failed
                job.status = (
                    BulkUploadStatus.COMPLETED if failed == 0
                    else BulkUploadStatus.PARTIALLY_FAILED
                )

    asyncio.run(_run())
