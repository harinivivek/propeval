import io
import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    ReportStatus,
    RequestType,
    UserType,
    VendorRequestStatus,
)
from app.models.lender import Lender
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest, RequestAcceptance
from app.models.user import Organization
from app.models.vendor import Vendor
from app.services import report_service, user_service


async def _setup_request_with_vendor(db: AsyncSession):
    """Create lender + vendor + accepted request."""
    lender_org = Organization(name="Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Bank", city="Mumbai")
    db.add(lender)
    lender_user = await user_service.create_user(
        db, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )

    vendor_org = Organization(name="Vendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="Vendor")
    db.add(vendor)
    await db.flush()

    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        area="Andheri",
        property_address="123 Main St",
        loan_applicant_name="John Doe",
        plot_extent_sqft=Decimal("1000.00"),
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.AWAITED,
        vendor_status=VendorRequestStatus.PENDING,
    )
    db.add(request)
    await db.flush()
    db.add(RequestAcceptance(request_id=request.id, vendor_id=vendor.id))
    await db.flush()
    return lender, vendor, lender_user, request


@pytest.mark.asyncio
async def test_upload_report_creates_report(db_session: AsyncSession):
    lender, vendor, _, request = await _setup_request_with_vendor(db_session)

    report, file_path = await report_service.create_report_for_request(
        db_session,
        request=request,
        vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
        valuation_amount=Decimal("5000000.00"),
        report_date=date(2026, 4, 9),
    )

    assert report.vendor_id == vendor.id
    assert report.status == ReportStatus.UPLOADED
    assert report.report_category == ReportCategory.VALUATION
    assert report.city == "Mumbai"
    assert report.property_address == "123 Main St"
    assert report.valuation_amount == Decimal("5000000.00")
    assert request.vendor_status == VendorRequestStatus.PENDING
    assert request.lender_status == LenderRequestStatus.AWAITED


@pytest.mark.asyncio
async def test_publish_sets_request_delivered(db_session: AsyncSession):
    lender, vendor, _, request = await _setup_request_with_vendor(db_session)

    report, _ = await report_service.create_report_for_request(
        db_session,
        request=request,
        vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
        report_date=date(2026, 4, 1),
    )
    report.content_json = {
        "anchor_fields": {
            "property_address": {"value": "123 Main St", "confidence": 0.9, "type": "text"},
            "property_type": {"value": "RESIDENTIAL", "confidence": 0.9, "type": "text"},
            "valuation_amount": {"value": "5000000", "confidence": 0.9, "type": "currency"},
        },
        "additional_fields": {},
    }
    report.status = ReportStatus.READY_TO_PUBLISH
    await db_session.flush()

    await report_service.publish_report(db_session, report)

    assert report.status == ReportStatus.PUBLISHED
    assert request.vendor_status == VendorRequestStatus.SENT
    assert request.lender_status == LenderRequestStatus.RECEIVED


@pytest.mark.asyncio
async def test_submit_revision_creates_revision(db_session: AsyncSession):
    _, vendor, _, request = await _setup_request_with_vendor(db_session)

    report, _ = await report_service.create_report_for_request(
        db_session,
        request=request,
        vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
        report_date=date(2026, 3, 15),
    )

    # Simulate lender sending back for revision
    request.lender_status = LenderRequestStatus.SENT_FOR_REVIEW
    request.vendor_status = VendorRequestStatus.REVISION
    await db_session.flush()

    revision = await report_service.submit_revision(
        db_session,
        report=report,
        request=request,
        file_path="reports/test/report_rev1.pdf",
        report_date=date(2026, 3, 20),
        comments="Updated valuation",
    )

    assert revision.revision_number == 1
    assert revision.comments == "Updated valuation"
    assert report.uploaded_file_path == "reports/test/report_rev1.pdf"
    assert request.vendor_status == VendorRequestStatus.REVISION
    assert request.lender_status == LenderRequestStatus.SENT_FOR_REVIEW
