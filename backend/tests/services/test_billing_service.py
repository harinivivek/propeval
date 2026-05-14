import uuid
from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.billing import VendorEarning, LenderPayable
from app.models.enums import (
    EarningType,
    PayableType,
    PaymentStatus,
    ReportCategory,
    ReportStatus,
    PropertyType,
    RequestType,
    LenderRequestStatus,
)
from app.models.lender import Lender
from app.models.report import Report
from app.models.request import ReportRequest
from app.models.user import Organization, User
from app.models.vendor import Vendor
from app.services import billing_service


async def _setup_billing_data(db: AsyncSession, suffix: str = "01"):
    """Create lender, vendor, request, report for billing tests."""
    from app.models.enums import UserType
    from app.services import user_service

    # Lender
    lender_org = Organization(name=f"Test Bank {suffix}", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name=f"Test Bank {suffix}", city="Mumbai")
    db.add(lender)
    lender_user = await user_service.create_user(
        db, email=f"lender{suffix}@test.com", mobile=f"900000{suffix}",
        full_name="Lender User", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )

    # Vendor
    vendor_org = Organization(name="Test Vendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="Test Vendor")
    db.add(vendor)
    await db.flush()

    # Request
    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.RECEIVED,
    )
    db.add(request)
    await db.flush()

    # Report
    report = Report(
        vendor_id=vendor.id,
        report_category=ReportCategory.VALUATION,
        status=ReportStatus.UPLOADED,
        city="Mumbai",
        report_date=date(2026, 1, 10),
    )
    db.add(report)
    await db.flush()

    return lender, vendor, request, report


@pytest.mark.asyncio
async def test_create_billing_entries(db_session: AsyncSession):
    lender, vendor, request, report = await _setup_billing_data(db_session)

    await billing_service.create_billing_entries(
        db_session,
        request=request,
        report=report,
        vendor_id=vendor.id,
    )

    # Check VendorEarning
    result = await db_session.execute(
        select(VendorEarning).where(VendorEarning.request_id == request.id)
    )
    earning = result.scalar_one()
    assert earning.vendor_id == vendor.id
    assert earning.amount == Decimal("2500.00")
    assert earning.earning_type == EarningType.REQUEST
    assert earning.lender_id == lender.id

    # Check LenderPayable
    result = await db_session.execute(
        select(LenderPayable).where(LenderPayable.request_id == request.id)
    )
    payable = result.scalar_one()
    assert payable.lender_id == lender.id
    assert payable.amount == Decimal("2500.00")
    assert payable.payable_type == PayableType.NEW_REQUEST
    assert payable.status == PaymentStatus.PENDING


@pytest.mark.asyncio
async def test_billing_month_format(db_session: AsyncSession):
    lender, vendor, request, report = await _setup_billing_data(db_session, suffix="02")

    await billing_service.create_billing_entries(
        db_session, request=request, report=report, vendor_id=vendor.id,
    )

    result = await db_session.execute(
        select(VendorEarning).where(VendorEarning.request_id == request.id)
    )
    earning = result.scalar_one()
    # Month should be YYYY-MM format
    assert len(earning.month) == 7
    assert earning.month[4] == "-"
