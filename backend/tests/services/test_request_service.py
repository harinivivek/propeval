from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import LenderPayable, VendorEarning
from app.models.enums import (
    LenderRequestStatus,
    ListingStatus,
    PaymentStatus,
    PropertyType,
    ReportCategory,
    ReportStatus,
    RequestType,
    ServiceType,
    UserType,
    VendorRequestStatus,
)
from app.models.lender import Lender
from app.models.listing import Listing, ListingReport
from app.models.pricing import PricingRule
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest
from app.models.user import Organization
from app.models.vendor import ServiceArea, Vendor
from app.services import request_service, user_service


async def _full_setup(db: AsyncSession):
    """Create lender with pricing + vendor with service area."""
    # Lender
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

    # Pricing rule
    rule = PricingRule(
        lender_id=lender.id,
        report_category=ReportCategory.VALUATION,
        city="Mumbai",
        property_type=PropertyType.RESIDENTIAL,
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("500.00"),
        nearby_additional_price=Decimal("500.00"),
    )
    db.add(rule)

    # Vendor
    vendor_org = Organization(name="Vendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="Vendor")
    db.add(vendor)
    await db.flush()
    sa = ServiceArea(
        vendor_id=vendor.id, city="Mumbai", areas=["Andheri"],
        service_type=ServiceType.VALUATION,
    )
    db.add(sa)
    await db.flush()

    return lender, lender_user, vendor


_MIN_PUBLISH_ANCHOR = {
    "anchor_fields": {
        "property_address": {"value": "123 Main St", "confidence": 0.9, "type": "text"},
        "property_type": {"value": "RESIDENTIAL", "confidence": 0.9, "type": "text"},
        "valuation_amount": {"value": "5000000", "confidence": 0.9, "type": "currency"},
    },
    "additional_fields": {},
}


async def _publish_ready_report(db: AsyncSession, report: Report) -> None:
    from app.services import report_service

    report.content_json = _MIN_PUBLISH_ANCHOR
    report.status = ReportStatus.READY_TO_PUBLISH
    await db.flush()
    await report_service.publish_report(db, report)


@pytest.mark.asyncio
async def test_create_request_with_broadcast(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
    )

    assert request.price == Decimal("2500.00")
    assert request.lender_status == LenderRequestStatus.SENT
    assert request.vendor_status == VendorRequestStatus.INCOMING
    assert request.request_type == RequestType.NEW


@pytest.mark.asyncio
async def test_create_request_with_specified_vendor(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
        vendor_specified_id=vendor.id,
    )

    assert request.vendor_specified_id == vendor.id
    assert request.vendor_status == VendorRequestStatus.INCOMING


@pytest.mark.asyncio
async def test_accept_report_creates_billing_and_listing(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St, Andheri",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
        vendor_specified_id=vendor.id,
    )

    # Simulate vendor accepting + uploading
    from app.services import broadcast_service, report_service
    await broadcast_service.accept_request(db_session, request=request, vendor_id=vendor.id)
    report, _ = await report_service.create_report_for_request(
        db_session,
        request=request,
        vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
        report_date=date(2026, 5, 1),
    )

    await _publish_ready_report(db_session, report)

    # Lender accepts
    await request_service.accept_report(
        db_session, request=request, report=report, vendor_id=vendor.id,
    )

    assert request.lender_status == LenderRequestStatus.ACCEPTED
    assert request.vendor_status == VendorRequestStatus.ACCEPTED

    # Check billing entries
    result = await db_session.execute(
        select(VendorEarning).where(VendorEarning.request_id == request.id)
    )
    assert result.scalar_one() is not None

    result = await db_session.execute(
        select(LenderPayable).where(LenderPayable.request_id == request.id)
    )
    assert result.scalar_one() is not None

    # Check listing created
    result = await db_session.execute(select(Listing))
    listing = result.scalar_one()
    assert listing.city == "Mumbai"
    assert listing.report_count == 1


@pytest.mark.asyncio
async def test_reject_report_creates_revision(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
        vendor_specified_id=vendor.id,
    )

    from app.services import broadcast_service, report_service
    await broadcast_service.accept_request(db_session, request=request, vendor_id=vendor.id)
    report, _ = await report_service.create_report_for_request(
        db_session, request=request, vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
        report_date=date(2026, 5, 2),
    )

    await _publish_ready_report(db_session, report)

    await request_service.reject_report(
        db_session, request=request, report=report, comments="Needs updated valuation",
    )

    assert request.lender_status == LenderRequestStatus.SENT_FOR_REVIEW
    assert request.vendor_status == VendorRequestStatus.REVISION

    result = await db_session.execute(
        select(ReportRevision).where(ReportRevision.report_id == report.id)
    )
    rev = result.scalar_one()
    assert rev.comments == "Needs updated valuation"
