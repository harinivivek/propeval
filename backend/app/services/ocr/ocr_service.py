import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import MEDIA_ROOT
from app.models.enums import ReportStatus
from app.models.report import Report
from app.services.ocr.base import OcrProvider
from app.services.report_service import sync_report_from_extraction

logger = logging.getLogger(__name__)


def _ocr_should_retry_later(exc: BaseException) -> bool:
    """True only for errors where a Celery retry may succeed (rate limits, upstream blips)."""
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError, ConnectionError, BrokenPipeError)):
        return True
    code = getattr(exc, "status_code", None)
    if code == 429:
        return True
    if code in (500, 502, 503, 504):
        return True
    return False


class OcrService:
    def __init__(self, provider: OcrProvider):
        self._provider = provider

    async def process_report(self, db: AsyncSession, report: Report) -> None:
        """Run OCR extraction on a report and store results."""
        try:
            report.status = ReportStatus.PROCESSING
            await db.flush()

            full_path = f"{MEDIA_ROOT}/{report.uploaded_file_path}"
            result = await self._provider.extract(full_path)

            report.content_json = result.to_content_json(
                provider=getattr(self._provider, "name", "unknown"),
                model=settings.OCR_MODEL,
            )
            sync_report_from_extraction(report)
            report.status = ReportStatus.READY_TO_PUBLISH
            logger.info(
                "OCR extraction succeeded for report %s (%d pages)",
                report.id, result.page_count,
            )
        except Exception as e:
            logger.exception("OCR extraction failed for report %s: %s", report.id, e)
            # Rollback to clear any failed flush (like Enum errors) before updating status
            await db.rollback()
            report = await db.merge(report)

            if _ocr_should_retry_later(e):
                # Do not mark EXTRACTION_FAILED — commit would be rolled back on re-raise anyway.
                # DB stays at last committed state (typically UPLOADED); Celery retries the task.
                raise e

            report.status = ReportStatus.EXTRACTION_FAILED
            await db.flush()
