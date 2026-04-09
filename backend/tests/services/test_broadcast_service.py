import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    BroadcastStatus,
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    ServiceType,
    UserType,
    VendorRequestStatus,
)
from app.models.lender import Lender
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.user import Organization, User
from app.models.vendor import ServiceArea, Vendor
from app.services import broadcast_service, user_service


async def _create_lender_and_request(db: AsyncSession):
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
    await db.flush()

    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        area="Andheri",
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.SENT,
    )
    db.add(request)
    await db.flush()
    return lender, lender_user, request


async def _create_vendor_with_area(
    db: AsyncSession, name: str, city: str, areas: list[str] | None, service_type: str,
):
    vendor_org = Organization(name=name, type=UserType.VENDOR, city=city)
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name=name)
    db.add(vendor)
    await db.flush()
    sa = ServiceArea(
        vendor_id=vendor.id, city=city, areas=areas,
        service_type=ServiceType(service_type),
    )
    db.add(sa)
    await db.flush()
    return vendor


@pytest.mark.asyncio
async def test_get_eligible_vendors(db_session: AsyncSession):
    await _create_lender_and_request(db_session)
    v1 = await _create_vendor_with_area(db_session, "V1", "Mumbai", ["Andheri", "Bandra"], "VALUATION")
    v2 = await _create_vendor_with_area(db_session, "V2", "Mumbai", None, "VALUATION")  # city-wide
    await _create_vendor_with_area(db_session, "V3", "Delhi", ["Andheri"], "VALUATION")  # wrong city
    await _create_vendor_with_area(db_session, "V4", "Mumbai", ["Andheri"], "LEGAL")  # wrong type

    vendors = await broadcast_service.get_eligible_vendors(
        db_session, city="Mumbai", area="Andheri", report_category="VALUATION",
    )
    vendor_ids = {v.id for v in vendors}
    assert v1.id in vendor_ids
    assert v2.id in vendor_ids
    assert len(vendors) == 2


@pytest.mark.asyncio
async def test_start_broadcast(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    for i in range(3):
        await _create_vendor_with_area(
            db_session, f"V{i}", "Mumbai", ["Andheri"], "VALUATION",
        )

    broadcast = await broadcast_service.start_broadcast(db_session, request=request)

    assert broadcast.broadcast_round == 1
    assert broadcast.status == BroadcastStatus.ACTIVE
    assert len(broadcast.vendor_ids) == 3
    assert request.vendor_status == VendorRequestStatus.INCOMING


@pytest.mark.asyncio
async def test_accept_request(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    vendor = await _create_vendor_with_area(
        db_session, "V1", "Mumbai", ["Andheri"], "VALUATION",
    )
    await broadcast_service.start_broadcast(db_session, request=request)

    acceptance = await broadcast_service.accept_request(
        db_session, request=request, vendor_id=vendor.id,
    )

    assert acceptance.vendor_id == vendor.id
    assert request.vendor_status == VendorRequestStatus.PENDING
    assert request.lender_status == LenderRequestStatus.AWAITED
    # Broadcast should be marked ACCEPTED
    result = await db_session.execute(
        select(RequestBroadcast).where(RequestBroadcast.request_id == request.id)
    )
    bc = result.scalar_one()
    assert bc.status == BroadcastStatus.ACCEPTED


@pytest.mark.asyncio
async def test_reject_request_specified_vendor_triggers_broadcast(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    vendor = await _create_vendor_with_area(
        db_session, "V1", "Mumbai", ["Andheri"], "VALUATION",
    )
    # Simulate direct assignment (no broadcast)
    request.vendor_specified_id = vendor.id
    request.vendor_status = VendorRequestStatus.INCOMING
    request.allow_broadcast_on_reject = True
    await db_session.flush()

    # Add another vendor to be found by broadcast
    await _create_vendor_with_area(
        db_session, "V2", "Mumbai", ["Andheri"], "VALUATION",
    )

    result = await broadcast_service.reject_request(
        db_session, request=request, vendor_id=vendor.id, reason="LOW_PRICE",
    )

    assert result == "broadcast_started"
    # Should have created a broadcast round
    bc_result = await db_session.execute(
        select(RequestBroadcast).where(RequestBroadcast.request_id == request.id)
    )
    bc = bc_result.scalar_one()
    assert bc.broadcast_round == 1


@pytest.mark.asyncio
async def test_assign_direct(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    vendor = await _create_vendor_with_area(
        db_session, "V1", "Mumbai", ["Andheri"], "VALUATION",
    )

    await broadcast_service.assign_direct(
        db_session, request=request, vendor_id=vendor.id,
    )

    assert request.vendor_status == VendorRequestStatus.INCOMING
    assert request.vendor_specified_id == vendor.id
