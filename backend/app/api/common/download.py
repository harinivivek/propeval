import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MEDIA_ROOT
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.lender import LenderUser
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{report_id}/download")
async def download_report(
    report_id: UUID,
    format: str = Query("original", pattern="^(original|template)$"),
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

    if format == "template" and current_user.user_type == "LENDER":
        pdf_bytes = await _try_render_template(db, report, current_user.id)
        if pdf_bytes:
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="report-{report.id}.pdf"'
                },
            )

    full_path = os.path.join(MEDIA_ROOT, report.uploaded_file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=full_path,
        media_type="application/pdf",
        filename=os.path.basename(report.uploaded_file_path),
    )


async def _try_render_template(
    db: AsyncSession, report: Report, user_id: UUID
) -> bytes | None:
    lu_result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == user_id)
    )
    lu = lu_result.scalar_one_or_none()
    if not lu:
        return None

    from app.services.template_service import get_active_template

    template = await get_active_template(db, lu.lender_id)
    if not template:
        return None

    from app.services.pdf_render_service import render_report_pdf

    return render_report_pdf(report, template)
