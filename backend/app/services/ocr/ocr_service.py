import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import MEDIA_ROOT
from app.models.enums import ReportStatus
from app.models.report import Report
from app.services.ocr.base import OcrProvider
from app.services.report_service import sync_report_from_extraction

logger = logging.getLogger(__name__)


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
            # Rollback to clear any failed flush (like Enum errors) before setting fail status
            await db.rollback()
            # Merge the report back into the session after rollback
            report = await db.merge(report)
            report.status = ReportStatus.EXTRACTION_FAILED
            await db.flush()
            # Re-raise if it's not a business logic failure (optional, based on retry needs)
            if not isinstance(e, (ValueError, KeyError)):
                raise e
