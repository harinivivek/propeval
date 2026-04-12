import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import MEDIA_ROOT
from app.models.enums import ReportStatus
from app.models.report import Report
from app.services.ocr.base import OcrProvider

logger = logging.getLogger(__name__)


class OcrService:
    def __init__(self, provider: OcrProvider):
        self._provider = provider

    async def process_report(self, db: AsyncSession, report: Report) -> None:
        """Run OCR extraction on a report and store results."""
        report.status = ReportStatus.PROCESSING
        await db.flush()

        try:
            full_path = f"{MEDIA_ROOT}/{report.uploaded_file_path}"
            result = await self._provider.extract(full_path)

            report.content_json = result.to_content_json(
                provider="claude",
                model=settings.OCR_MODEL,
            )
            report.status = ReportStatus.READY_TO_PUBLISH
            logger.info(
                "OCR extraction succeeded for report %s (%d pages)",
                report.id, result.page_count,
            )
        except Exception as e:
            logger.exception("OCR extraction failed for report %s: %s", report.id, e)
            report.status = ReportStatus.EXTRACTION_FAILED

        await db.flush()
