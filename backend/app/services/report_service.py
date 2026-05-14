import os
import uuid as uuid_mod
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, update as sa_update
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
from app.models.request import ReportRequest, RequestAcceptance


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
    report_date: date,
    valuation_amount: Decimal | None = None,
) -> tuple[Report, str]:
    """Create a Report linked to a request.

    Lender/vendor request statuses stay AWAITED/PENDING until the vendor publishes
    (see ``publish_report``): the lender only moves to RECEIVED once the report is
    PUBLISHED.
    """
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
    await db.flush()

    acc_result = await db.execute(
        select(RequestAcceptance).where(
            RequestAcceptance.request_id == request.id,
            RequestAcceptance.vendor_id == vendor_id,
        )
    )
    acc = acc_result.scalar_one_or_none()
    if acc:
        acc.report_id = report.id

    await db.flush()
    return report, file_path


async def submit_revision(
    db: AsyncSession,
    *,
    report: Report,
    request: ReportRequest,
    file_path: str,
    report_date: date,
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
    report.report_date = report_date

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


def _decimal_from_anchor_value(raw) -> Decimal | None:
    """Parse a numeric anchor field value to Decimal."""
    if raw is None or isinstance(raw, dict):
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        try:
            return Decimal(str(raw))
        except (ArithmeticError, ValueError):
            return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return Decimal(s.replace(",", ""))
    except (ArithmeticError, ValueError):
        return None


def _extraction_field_value(content_json: dict, key: str):
    """Read a field value from anchor_fields first, then additional_fields."""
    for section in ("anchor_fields", "additional_fields"):
        block = content_json.get(section) or {}
        if not isinstance(block, dict):
            continue
        fd = block.get(key)
        if isinstance(fd, dict) and "value" in fd:
            val = fd.get("value")
            if val is not None and val != "":
                return val
    return None


def sync_report_from_extraction(report: Report) -> None:
    """Sync core fields from content_json to top-level columns for listing and search."""
    if not report.content_json:
        return

    cj = report.content_json if isinstance(report.content_json, dict) else {}
    anchor = cj.get("anchor_fields", {}) or {}
    if not isinstance(anchor, dict):
        anchor = {}

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

    pc_raw = _extraction_field_value(cj, "pin_code")
    if pc_raw is not None:
        digits = "".join(c for c in str(pc_raw) if c.isdigit())
        if len(digits) >= 6:
            report.pin_code = digits[:6]

    lat_raw = _extraction_field_value(cj, "latitude")
    lng_raw = _extraction_field_value(cj, "longitude")
    lat_d = _decimal_from_anchor_value(lat_raw)
    lng_d = _decimal_from_anchor_value(lng_raw)
    if lat_d is not None and lng_d is not None:
        if Decimal("-90") <= lat_d <= Decimal("90") and Decimal("-180") <= lng_d <= Decimal("180"):
            report.latitude = lat_d
            report.longitude = lng_d


def display_property_address(report: Report) -> str | None:
    """Column value for lists: prefer denormalized field, else anchor extraction (legacy rows)."""
    try:
        if report.property_address:
            return report.property_address
        cj = report.content_json
        if not cj or not isinstance(cj, dict):
            return None
        raw_anchor = cj.get("anchor_fields")
        if not isinstance(raw_anchor, dict):
            return None
        field = raw_anchor.get("property_address")
        if isinstance(field, str):
            s = field.strip()
            return s or None
        if not isinstance(field, dict):
            return None
        val = field.get("value")
        if val is None:
            return None
        s = str(val).strip()
        return s or None
    except (TypeError, AttributeError, ValueError):
        return None


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


async def update_report_map_coordinates(
    db: AsyncSession,
    report: Report,
    *,
    latitude: Decimal,
    longitude: Decimal,
) -> Report:
    """Set WGS84 coordinates on the report for coverage map (manual entry)."""
    if not (Decimal("-90") <= latitude <= Decimal("90")):
        raise ValueError("latitude must be between -90 and 90")
    if not (Decimal("-180") <= longitude <= Decimal("180")):
        raise ValueError("longitude must be between -180 and 180")

    report.latitude = latitude
    report.longitude = longitude

    if not report.content_json or not isinstance(report.content_json, dict):
        report.content_json = {
            "extraction_version": 1,
            "provider": "manual",
            "anchor_fields": {},
            "additional_fields": {},
            "is_edited": True,
        }
    content = dict(report.content_json)
    anchor = dict(content.get("anchor_fields") or {})
    anchor["latitude"] = {
        "value": str(latitude),
        "confidence": 1.0,
        "type": "number",
        "edited": True,
    }
    anchor["longitude"] = {
        "value": str(longitude),
        "confidence": 1.0,
        "type": "number",
        "edited": True,
    }
    content["anchor_fields"] = anchor
    content["is_edited"] = True
    report.content_json = content

    await db.flush()
    return report


async def publish_report(db: AsyncSession, report: Report) -> Report:
    """Validate, set PUBLISHED, then mark the linked request delivered to the lender."""
    if report.status != ReportStatus.READY_TO_PUBLISH:
        raise ValueError(f"Report must be in READY_TO_PUBLISH status, currently: {report.status.value}")

    missing = validate_for_publish(report.content_json)
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    report.status = ReportStatus.PUBLISHED

    acc_result = await db.execute(
        select(RequestAcceptance).where(RequestAcceptance.report_id == report.id)
    )
    acc = acc_result.scalar_one_or_none()
    if acc:
        req_result = await db.execute(
            select(ReportRequest).where(ReportRequest.id == acc.request_id)
        )
        req = req_result.scalar_one_or_none()
        if req:
            req.vendor_status = VendorRequestStatus.SENT
            req.lender_status = LenderRequestStatus.RECEIVED
            from app.services.request_service import check_auto_approve

            await check_auto_approve(
                db, request=req, report=report, vendor_id=acc.vendor_id,
            )

    await db.flush()
    return report


async def soft_delete_vendor_reports(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    report_ids: list[UUID],
) -> int:
    """Soft-delete reports owned by the vendor; clears acceptance pointers."""
    if not report_ids:
        return 0

    res = await db.execute(
        select(Report.id).where(
            Report.vendor_id == vendor_id,
            Report.id.in_(report_ids),
            Report.is_active == True,  # noqa: E712
        )
    )
    ids = [row[0] for row in res.all()]
    if not ids:
        return 0

    await db.execute(
        sa_update(RequestAcceptance)
        .where(RequestAcceptance.report_id.in_(ids))
        .values(report_id=None)
    )
    await db.execute(
        sa_update(Report).where(Report.id.in_(ids)).values(is_active=False)
    )
    await db.flush()
    return len(ids)
