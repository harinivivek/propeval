import os
import uuid as uuid_mod
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ALLOWED_CONTENT_TYPES, MAX_UPLOAD_SIZE_MB, MEDIA_ROOT, REPORTS_DIR, REQUIRED_REPORT_FIELDS
from app.models.enums import (
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    ReportStatus,
    VendorRequestStatus,
)
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest


class InvalidFileError(Exception):
    pass


def validate_upload(content_type: str, size: int, max_upload_size_mb: int = MAX_UPLOAD_SIZE_MB) -> None:
    """Validate file type and size."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidFileError(f"File type '{content_type}' not allowed. Only PDF accepted.")
    max_bytes = max_upload_size_mb * 1024 * 1024
    if size > max_bytes:
        raise InvalidFileError(f"File too large. Maximum {max_upload_size_mb}MB allowed.")


def generate_report_path(vendor_id: UUID, report_id: UUID, suffix: str = "") -> str:
    """Generate the storage path for a report file."""
    filename = f"{report_id}{suffix}.pdf"
    return os.path.join(REPORTS_DIR, str(vendor_id), str(report_id), filename)


def get_full_path(relative_path: str) -> str:
    """Get absolute path from relative path."""
    return os.path.join(MEDIA_ROOT, relative_path)


async def save_file(relative_path: str, content: bytes) -> None:
    """Save file content to disk."""
    full_path = get_full_path(relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(content)


async def create_report_for_request(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
    file_path: str,
    valuation_amount: Decimal | None = None,
    report_date: date | None = None,
) -> tuple[Report, str]:
    """Create a Report linked to a request, updating statuses."""
    report = Report(
        vendor_id=vendor_id,
        report_category=request.report_category,
        status=ReportStatus.UPLOADED,
        property_address=request.property_address,
        city=request.city,
        property_type=request.property_type,
        plot_extent_sqft=request.plot_extent_sqft,
        loan_applicant_name=request.loan_applicant_name,
        valuation_amount=valuation_amount,
        report_date=report_date,
        uploaded_file_path=file_path,
    )
    db.add(report)

    request.vendor_status = VendorRequestStatus.SENT
    request.lender_status = LenderRequestStatus.RECEIVED

    await db.flush()
    return report, file_path


async def submit_revision(
    db: AsyncSession,
    *,
    report: Report,
    request: ReportRequest,
    file_path: str,
    comments: str | None = None,
) -> ReportRevision:
    """Create a revision for an existing report."""
    # Get next revision number
    result = await db.execute(
        select(func.coalesce(func.max(ReportRevision.revision_number), 0))
        .where(ReportRevision.report_id == report.id)
    )
    max_rev = result.scalar()
    next_rev = max_rev + 1

    revision = ReportRevision(
        report_id=report.id,
        revision_number=next_rev,
        comments=comments,
    )
    db.add(revision)

    # Update report with new file
    report.uploaded_file_path = file_path
    report.status = ReportStatus.UPLOADED

    # Reset request statuses
    request.vendor_status = VendorRequestStatus.SENT
    request.lender_status = LenderRequestStatus.RECEIVED

    await db.flush()
    return revision


async def get_report(db: AsyncSession, report_id: UUID) -> Report | None:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    return result.scalar_one_or_none()


async def get_report_revisions(db: AsyncSession, report_id: UUID) -> list[ReportRevision]:
    result = await db.execute(
        select(ReportRevision)
        .where(ReportRevision.report_id == report_id)
        .order_by(ReportRevision.revision_number.desc())
    )
    return list(result.scalars().all())


def validate_for_publish(content_json: dict | None) -> list[str]:
    """Return list of missing required fields. Empty list = valid."""
    if not content_json:
        return REQUIRED_REPORT_FIELDS[:]

    anchor = content_json.get("anchor_fields", {})
    missing = []
    for field_name in REQUIRED_REPORT_FIELDS:
        field_data = anchor.get(field_name)
        if not field_data or not field_data.get("value"):
            missing.append(field_name)
    return missing


def sync_report_from_extraction(report: Report) -> None:
    """Sync core fields from content_json to top-level columns for listing and search."""
    if not report.content_json:
        return

    anchor = report.content_json.get("anchor_fields", {})

    if "valuation_amount" in anchor:
        val = anchor["valuation_amount"].get("value")
        if val:
            try:
                # Clean common currency formatting
                clean_val = str(val).replace(",", "").replace("₹", "").replace("INR", "").strip()
                report.valuation_amount = Decimal(clean_val)
            except (ValueError, TypeError, ArithmeticError):
                pass

    if "property_address" in anchor:
        addr = anchor["property_address"].get("value")
        if addr:
            report.property_address = addr

    if "owner_name" in anchor:
        name = anchor["owner_name"].get("value")
        if name:
            report.loan_applicant_name = name

    if "property_type" in anchor:
        pt_val = anchor["property_type"].get("value")
        if pt_val:
            try:
                pt_upper = str(pt_val).upper()
                if pt_upper in PropertyType.__members__:
                    report.property_type = PropertyType(pt_upper)
            except (ValueError, KeyError):
                pass


async def update_extracted_data(
    db: AsyncSession,
    report: Report,
    anchor_fields: dict,
    additional_fields: dict,
) -> Report:
    """Update report's content_json with edited extraction data."""
    if not report.content_json:
        report.content_json = {
            "extraction_version": 1,
            "provider": "manual",
            "anchor_fields": {},
            "additional_fields": {},
            "is_edited": True,
        }

    content = dict(report.content_json)
    content["anchor_fields"] = anchor_fields
    content["additional_fields"] = additional_fields
    content["is_edited"] = True
    report.content_json = content
    sync_report_from_extraction(report)
    await db.flush()
    return report


async def publish_report(db: AsyncSession, report: Report) -> Report:
    """Validate and transition report to PUBLISHED status."""
    if report.status != ReportStatus.READY_TO_PUBLISH:
        raise ValueError(f"Report must be in READY_TO_PUBLISH status, currently: {report.status.value}")

    missing = validate_for_publish(report.content_json)
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    report.status = ReportStatus.PUBLISHED
    await db.flush()
    return report
