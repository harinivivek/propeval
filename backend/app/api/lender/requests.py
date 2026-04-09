from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.schemas.request import (
    EligibleVendorResponse,
    RejectReportInput,
    ReportRequestCreateInput,
    ReportRequestDetail,
    ReportRequestResponse,
)
from app.services import broadcast_service, report_service, request_service
from app.services.broadcast_service import NoVendorsAvailableError
from app.services.pricing_service import PricingNotFoundError
from app.services.request_service import InvalidStatusTransition

router = APIRouter(prefix="/api/lender/requests", tags=["lender-requests"])


@router.post("/", response_model=ReportRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: ReportRequestCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    """Create a new report request."""
    from sqlalchemy import select
    from app.models.lender import LenderUser
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == current_user.id)
    )
    lender_user = result.scalar_one_or_none()
    if not lender_user:
        raise HTTPException(status_code=400, detail="User not associated with a lender")

    try:
        request = await request_service.create_request(
            db,
            lender_id=lender_user.lender_id,
            lender_user_id=current_user.id,
            branch_id=None,
            report_category=payload.report_category,
            property_address=payload.property_address,
            city=payload.city,
            area=payload.area,
            pin_code=payload.pin_code,
            property_type=payload.property_type,
            plot_extent_sqft=payload.plot_extent_sqft,
            built_up_sqft=payload.built_up_sqft,
            loan_applicant_name=payload.loan_applicant_name,
            vendor_specified_id=payload.vendor_specified_id,
            allow_broadcast_on_reject=payload.allow_broadcast_on_reject,
            comments=payload.comments,
        )
    except PricingNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NoVendorsAvailableError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return request


@router.get("/vendors", response_model=list[EligibleVendorResponse])
async def get_eligible_vendors(
    city: str = Query(...),
    report_category: str = Query(...),
    area: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    vendors = await broadcast_service.get_eligible_vendors(
        db, city=city, area=area, report_category=report_category,
    )
    return [
        EligibleVendorResponse(
            id=v.id,
            name=v.name,
            city=v.office_city,
        )
        for v in vendors
    ]


@router.get("/", response_model=list[ReportRequestResponse])
async def list_requests(
    status_filter: str | None = Query(None, alias="status"),
    report_category: str | None = Query(None),
    property_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    from sqlalchemy import select
    from app.models.lender import LenderUser
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == current_user.id)
    )
    lender_user = result.scalar_one_or_none()
    if not lender_user:
        raise HTTPException(status_code=400, detail="User not associated with a lender")

    return await request_service.list_requests(
        db,
        lender_id=lender_user.lender_id,
        status_filter=status_filter,
        report_category=report_category,
        property_type=property_type,
        page=page,
        per_page=per_page,
    )


@router.get("/{request_id}", response_model=ReportRequestResponse)
async def get_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.post("/{request_id}/accept")
async def accept_report(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    from sqlalchemy import select
    from app.models.request import RequestAcceptance
    acceptance_result = await db.execute(
        select(RequestAcceptance).where(RequestAcceptance.request_id == request_id)
    )
    acceptance = acceptance_result.scalar_one_or_none()
    if not acceptance:
        raise HTTPException(status_code=400, detail="No vendor accepted this request yet")

    from app.models.report import Report
    report_result = await db.execute(
        select(Report).where(
            Report.vendor_id == acceptance.vendor_id,
            Report.is_active == True,
        ).order_by(Report.created_at.desc())
    )
    report = report_result.scalars().first()
    if not report:
        raise HTTPException(status_code=400, detail="No report uploaded yet")

    try:
        await request_service.accept_report(
            db, request=req, report=report, vendor_id=acceptance.vendor_id,
        )
    except InvalidStatusTransition as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"detail": "Report accepted"}


@router.post("/{request_id}/reject")
async def reject_report(
    request_id: UUID,
    payload: RejectReportInput,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    from sqlalchemy import select
    from app.models.request import RequestAcceptance
    from app.models.report import Report
    acceptance_result = await db.execute(
        select(RequestAcceptance).where(RequestAcceptance.request_id == request_id)
    )
    acceptance = acceptance_result.scalar_one_or_none()
    if not acceptance:
        raise HTTPException(status_code=400, detail="No vendor accepted this request yet")

    report_result = await db.execute(
        select(Report).where(
            Report.vendor_id == acceptance.vendor_id,
            Report.is_active == True,
        ).order_by(Report.created_at.desc())
    )
    report = report_result.scalars().first()
    if not report:
        raise HTTPException(status_code=400, detail="No report uploaded yet")

    try:
        await request_service.reject_report(
            db, request=req, report=report, comments=payload.comments,
        )
    except InvalidStatusTransition as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"detail": "Report sent back for revision"}
