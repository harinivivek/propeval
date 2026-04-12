import uuid as uuid_mod
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MAX_BULK_UPLOAD_FILES
from app.core.database import get_db
from app.core.deps import require_role
from app.models.bulk_upload import BulkUploadJob
from app.models.enums import BulkUploadStatus, ReportCategory, ReportStatus
from app.models.report import Report
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.bulk_upload import BulkUploadJobResponse, BulkUploadReportStatus
from app.schemas.report import ExtractedDataUpdate, ReportResponse
from app.services import report_service
from app.services.report_service import InvalidFileError

router = APIRouter(prefix="/api/vendor/reports", tags=["vendor-reports"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser).where(VendorUser.user_id == user_id)
    )
    vu = result.scalar_one_or_none()
    if not vu:
        raise HTTPException(status_code=400, detail="User not associated with a vendor")
    return vu.vendor_id


@router.post("/bulk-upload", response_model=BulkUploadJobResponse)
async def bulk_upload(
    files: list[UploadFile] = File(...),
    report_category: str = "VALUATION",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Upload multiple PDF reports for bulk processing."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    if len(files) > MAX_BULK_UPLOAD_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_BULK_UPLOAD_FILES} files per batch",
        )

    category = ReportCategory(report_category)

    job = BulkUploadJob(
        vendor_id=vendor_id,
        total_reports=len(files),
        status=BulkUploadStatus.PENDING,
    )
    db.add(job)
    await db.flush()

    from app.services.system_config_service import get_config_values
    config = await get_config_values()

    report_ids = []
    for upload_file in files:
        try:
            content = await upload_file.read()
            report_service.validate_upload(upload_file.content_type, len(content), max_upload_size_mb=config["max_upload_size_mb"])
        except InvalidFileError as e:
            raise HTTPException(status_code=400, detail=f"{upload_file.filename}: {e}")

        report_id = uuid_mod.uuid4()
        relative_path = report_service.generate_report_path(vendor_id, report_id)
        await report_service.save_file(relative_path, content)

        report = Report(
            id=report_id,
            vendor_id=vendor_id,
            report_category=category,
            status=ReportStatus.UPLOADED,
            uploaded_file_path=relative_path,
            bulk_upload_job_id=job.id,
        )
        db.add(report)
        report_ids.append(str(report_id))

    await db.flush()

    from app.jobs.ocr_tasks import process_bulk_upload
    process_bulk_upload.delay(str(job.id), report_ids)

    return job


@router.get("/bulk-jobs", response_model=list[BulkUploadJobResponse])
async def list_bulk_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    result = await db.execute(
        select(BulkUploadJob)
        .where(BulkUploadJob.vendor_id == vendor_id)
        .order_by(BulkUploadJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all())


@router.get("/bulk-jobs/{job_id}", response_model=BulkUploadJobResponse)
async def get_bulk_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    result = await db.execute(
        select(BulkUploadJob).where(BulkUploadJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Bulk job not found")
    if job.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Bulk job not found")
    return job


@router.get("/bulk-jobs/{job_id}/reports", response_model=list[BulkUploadReportStatus])
async def get_bulk_job_reports(
    job_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    job_result = await db.execute(
        select(BulkUploadJob).where(BulkUploadJob.id == job_id)
    )
    job = job_result.scalar_one_or_none()
    if not job or job.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Bulk job not found")
    result = await db.execute(
        select(Report)
        .where(Report.bulk_upload_job_id == job_id)
        .order_by(Report.created_at)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    reports = result.scalars().all()
    return [
        BulkUploadReportStatus(
            report_id=r.id,
            status=r.status.value,
            property_address=r.property_address,
        )
        for r in reports
    ]


@router.post("/{report_id}/retry-extraction", response_model=ReportResponse)
async def retry_extraction(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    report = await report_service.get_report(db, report_id)
    if not report or report.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != ReportStatus.EXTRACTION_FAILED:
        raise HTTPException(status_code=400, detail="Report is not in failed state")

    report.status = ReportStatus.UPLOADED
    await db.flush()

    from app.jobs.ocr_tasks import process_report_ocr
    process_report_ocr.delay(str(report_id))

    return report


@router.put("/{report_id}/extracted-data", response_model=ReportResponse)
async def update_extracted_data(
    report_id: UUID,
    payload: ExtractedDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    report = await report_service.get_report(db, report_id)
    if not report or report.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Report not found")

    anchor = {k: v.model_dump() for k, v in payload.anchor_fields.items()}
    additional = {k: v.model_dump() for k, v in payload.additional_fields.items()}

    await report_service.update_extracted_data(db, report, anchor, additional)
    return report


@router.post("/{report_id}/publish", response_model=ReportResponse)
async def publish_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    report = await report_service.get_report(db, report_id)
    if not report or report.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        await report_service.publish_report(db, report)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return report


@router.get("/{report_id}/pdf")
async def get_report_pdf(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    report = await report_service.get_report(db, report_id)
    if not report or not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Report not found")

    full_path = report_service.get_full_path(report.uploaded_file_path)
    return FileResponse(full_path, media_type="application/pdf")
