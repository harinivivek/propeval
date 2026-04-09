import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MEDIA_ROOT
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{report_id}/download")
async def download_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="No file uploaded for this report")

    full_path = os.path.join(MEDIA_ROOT, report.uploaded_file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=full_path,
        media_type="application/pdf",
        filename=os.path.basename(report.uploaded_file_path),
    )
