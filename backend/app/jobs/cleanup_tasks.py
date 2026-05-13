import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from celery import shared_task

logger = logging.getLogger(__name__)

ONE_DAY_AGO_SECONDS = 86400


def _list_files(directory: str) -> list[str]:
    """List all files in directory tree."""
    files = []
    base = Path(directory)
    if not base.exists():
        return files
    for f in base.rglob("*"):
        if f.is_file():
            files.append(str(f))
    return files


def _is_old_enough(filepath: str) -> bool:
    """Check if file is older than 24 hours (avoid race with in-progress uploads)."""
    try:
        mtime = os.path.getmtime(filepath)
        age = datetime.now(timezone.utc).timestamp() - mtime
        return age > ONE_DAY_AGO_SECONDS
    except OSError:
        return False


async def _cleanup_reports(db_session) -> int:
    """Delete report PDFs not referenced by any active report."""
    from sqlalchemy import select
    from app.core.constants import MEDIA_ROOT, REPORTS_DIR
    from app.models.report import Report

    reports_dir = f"{MEDIA_ROOT}/{REPORTS_DIR}"
    all_files = _list_files(reports_dir)
    if not all_files:
        return 0

    result = await db_session.execute(
        select(Report.uploaded_file_path).where(Report.uploaded_file_path.isnot(None))
    )
    active_paths = {f"{MEDIA_ROOT}/{p}" for p in result.scalars().all() if p}

    # Also check rendered PDF paths
    result2 = await db_session.execute(
        select(Report.rendered_pdf_path).where(Report.rendered_pdf_path.isnot(None))
    )
    active_paths.update(f"{MEDIA_ROOT}/{p}" for p in result2.scalars().all() if p)

    deleted = 0
    for filepath in all_files:
        if filepath not in active_paths and _is_old_enough(filepath):
            try:
                os.remove(filepath)
                logger.debug("Deleted orphaned report file: %s", filepath)
                deleted += 1
            except OSError as e:
                logger.warning("Failed to delete %s: %s", filepath, e)

    return deleted


async def _cleanup_logos(db_session) -> int:
    """Delete logo files not referenced by any template."""
    from sqlalchemy import select
    from app.core.constants import MEDIA_ROOT, LOGOS_DIR
    from app.models.template import ReportTemplate

    logos_dir = f"{MEDIA_ROOT}/{LOGOS_DIR}"
    all_files = _list_files(logos_dir)
    if not all_files:
        return 0

    result = await db_session.execute(
        select(ReportTemplate.logo_path).where(ReportTemplate.logo_path.isnot(None))
    )
    active_paths = {f"{MEDIA_ROOT}/{p}" for p in result.scalars().all() if p}

    deleted = 0
    for filepath in all_files:
        if filepath not in active_paths and _is_old_enough(filepath):
            try:
                os.remove(filepath)
                logger.debug("Deleted orphaned logo file: %s", filepath)
                deleted += 1
            except OSError as e:
                logger.warning("Failed to delete %s: %s", filepath, e)

    return deleted


async def _run_cleanup():
    from app.core.database import get_async_session_context

    async with get_async_session_context() as db:
        reports_deleted = await _cleanup_reports(db)
        logos_deleted = await _cleanup_logos(db)
        logger.info(
            "Orphaned file cleanup complete: %d reports, %d logos deleted",
            reports_deleted, logos_deleted,
        )


@shared_task(bind=True, name="app.jobs.cleanup_tasks.cleanup_orphaned_files")
def cleanup_orphaned_files(self):
    """Weekly cleanup of orphaned media files."""
    logger.info("Starting orphaned file cleanup")
    asyncio.run(_run_cleanup())
