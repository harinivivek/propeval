from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import (
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    ServiceType,
    UserType,
    VendorRequestStatus,
    VendorRole,
)
from app.models.lender import Lender
from app.models.request import ReportRequest
from app.models.user import Organization
from app.models.vendor import ServiceArea, Vendor, VendorUser
from app.services import user_service


async def _setup_vendor_with_request(db: AsyncSession):
    """Create vendor + lender + request. Return (vendor_token, request_id, vendor_id)."""
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
    vendor_user = await user_service.create_user(
        db, email="vendor@test.com", mobile="9000000002",
        full_name="Vendor User", password="test123",
        user_type=UserType.VENDOR, organization_id=vendor_org.id,
    )
    vu = VendorUser(
        user_id=vendor_user.id, vendor_id=vendor.id,
        role=VendorRole.VENDOR_ADMIN,
    )
    db.add(vu)

    sa = ServiceArea(
        vendor_id=vendor.id, city="Mumbai", areas=["Andheri"],
        service_type=ServiceType.VALUATION,
    )
    db.add(sa)

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
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.SENT,
        vendor_status=VendorRequestStatus.INCOMING,
        vendor_specified_id=vendor.id,
    )
    db.add(request)
    await db.flush()

    token = create_access_token(str(vendor_user.id))
    return token, str(request.id), str(vendor.id)


@pytest.mark.asyncio
async def test_vendor_accept_request(client: AsyncClient, db_session: AsyncSession):
    token, request_id, _ = await _setup_vendor_with_request(db_session)

    response = await client.post(
        f"/api/vendor/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "accepted" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_vendor_reject_request(client: AsyncClient, db_session: AsyncSession):
    token, request_id, _ = await _setup_vendor_with_request(db_session)

    response = await client.post(
        f"/api/vendor/requests/{request_id}/reject",
        json={"reason": "LOW_PRICE", "message": "Price too low"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_vendor_list_requests(client: AsyncClient, db_session: AsyncSession):
    token, _, _ = await _setup_vendor_with_request(db_session)

    response = await client.get(
        "/api/vendor/requests/?status=incoming",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_requires_vendor_role(client: AsyncClient, db_session: AsyncSession):
    lender_org = Organization(name="Bank", type=UserType.LENDER)
    db_session.add(lender_org)
    await db_session.flush()
    user = await user_service.create_user(
        db_session, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )
    token = create_access_token(str(user.id))

    response = await client.get(
        "/api/vendor/requests/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
