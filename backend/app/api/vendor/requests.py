import os
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import VendorRequestStatus
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.broadcast import RejectionInput
from app.schemas.report import ReportResponse
from app.schemas.request import ReportRequestResponse
from app.services import broadcast_service, report_service
from app.services.report_service import InvalidFileError

router = APIRouter(prefix="/api/vendor/requests", tags=["vendor-requests"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser).where(VendorUser.user_id == user_id)
    )
    vu = result.scalar_one_or_none()
    if not vu:
        raise HTTPException(status_code=400, detail="User not associated with a vendor")
    return vu.vendor_id


@router.get("/", response_model=list[ReportRequestResponse])
async def list_requests(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """List requests for vendor: incoming, pending, completed."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    stmt = select(ReportRequest).where(
        (ReportRequest.vendor_specified_id == vendor_id)
        | (
            ReportRequest.id.in_(
                select(RequestBroadcast.request_id).where(
                    RequestBroadcast.vendor_ids.any(vendor_id)
                )
            )
        )
        | (
            ReportRequest.id.in_(
                select(RequestAcceptance.request_id).where(
                    RequestAcceptance.vendor_id == vendor_id
                )
            )
        )
    )

    if status_filter == "incoming":
        stmt = stmt.where(ReportRequest.vendor_status == VendorRequestStatus.INCOMING)
    elif status_filter == "pending":
        stmt = stmt.where(
            ReportRequest.vendor_status.in_([
                VendorRequestStatus.PENDING,
                VendorRequestStatus.REVISION,
            ])
        )
    elif status_filter == "completed":
        stmt = stmt.where(
            ReportRequest.vendor_status.in_([
                VendorRequestStatus.SENT,
                VendorRequestStatus.ACCEPTED,
            ])
        )

    stmt = stmt.order_by(ReportRequest.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{request_id}", response_model=ReportRequestResponse)
async def get_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("VENDOR")),
):
    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.post("/{request_id}/accept")
async def accept_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    acceptance = await broadcast_service.accept_request(
        db, request=req, vendor_id=vendor_id,
    )
    return {"detail": "Request accepted", "acceptance_id": str(acceptance.id)}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: UUID,
    payload: RejectionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    result = await broadcast_service.reject_request(
        db, request=req, vendor_id=vendor_id,
        reason=payload.reason, message=payload.message,
    )
    return {"detail": "Request rejected", "action": result}


@router.post("/{request_id}/upload", response_model=ReportResponse)
async def upload_report(
    request_id: UUID,
    file: UploadFile = File(...),
    valuation_amount: Decimal | None = Form(None),
    report_date: date = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Upload a report PDF for an accepted request."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    try:
        content = await file.read()
        report_service.validate_upload(file.content_type, len(content))
    except InvalidFileError as e:
        raise HTTPException(status_code=400, detail=str(e))

    import uuid
    report_id = uuid.uuid4()
    relative_path = report_service.generate_report_path(vendor_id, report_id)
    await report_service.save_file(relative_path, content)

    report, _ = await report_service.create_report_for_request(
        db,
        request=req,
        vendor_id=vendor_id,
        file_path=relative_path,
        valuation_amount=valuation_amount,
        report_date=report_date,
    )

    # Dispatch OCR extraction
    from app.jobs.ocr_tasks import process_report_ocr
    process_report_ocr.delay(str(report.id))

    return report


@router.get("/{request_id}/report", response_model=ReportResponse)
async def get_request_report(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Get the latest active report uploaded by this vendor for a given request."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    result = await db.execute(
        select(Report)
        .where(Report.vendor_id == vendor_id, Report.is_active == True)
        .order_by(Report.created_at.desc())
        .limit(1)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="No report found for this request")
    return report


@router.post("/{request_id}/revise", response_model=ReportResponse)
async def revise_report(
    request_id: UUID,
    file: UploadFile = File(...),
    report_date: date = Form(...),
    comments: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Submit a revised report."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    result = await db.execute(
        select(Report).where(
            Report.vendor_id == vendor_id,
            Report.is_active == True,
        ).order_by(Report.created_at.desc())
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=400, detail="No existing report found to revise")

    try:
        content = await file.read()
        report_service.validate_upload(file.content_type, len(content))
    except InvalidFileError as e:
        raise HTTPException(status_code=400, detail=str(e))

    relative_path = report_service.generate_report_path(
        vendor_id, report.id, suffix=f"_rev_next",
    )
    await report_service.save_file(relative_path, content)

    await report_service.submit_revision(
        db,
        report=report,
        request=req,
        file_path=relative_path,
        report_date=report_date,
        comments=comments,
    )

    # Dispatch OCR extraction on revised report
    from app.jobs.ocr_tasks import process_report_ocr
    process_report_ocr.delay(str(report.id))

    return report
