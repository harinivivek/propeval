from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import (
    LenderRole,
    PropertyType,
    ReportCategory,
    ServiceType,
    UserType,
)
from app.models.lender import Lender, LenderUser
from app.models.pricing import PricingRule
from app.models.user import Organization
from app.models.vendor import ServiceArea, Vendor
from app.services import user_service


async def _setup_lender_with_pricing(db: AsyncSession):
    """Create lender org, user, pricing rule. Return (token, lender_id, vendor_id)."""
    lender_org = Organization(name="Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Bank", city="Mumbai")
    db.add(lender)
    await db.flush()
    user = await user_service.create_user(
        db, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )
    lu = LenderUser(
        user_id=user.id, lender_id=lender.id,
        role=LenderRole.ORG_ADMIN,
    )
    db.add(lu)

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

    # Add a vendor for broadcast
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

    token = create_access_token(str(user.id))
    return token, str(lender.id), str(vendor.id)


@pytest.mark.asyncio
async def test_create_request(client: AsyncClient, db_session: AsyncSession):
    token, lender_id, _ = await _setup_lender_with_pricing(db_session)

    response = await client.post(
        "/api/lender/requests/",
        json={
            "report_category": "VALUATION",
            "property_address": "123 Main St, Andheri",
            "city": "Mumbai",
            "area": "Andheri",
            "property_type": "RESIDENTIAL",
            "loan_applicant_name": "John Doe",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["price"] == "2500.00"
    assert data["lender_status"] == "SENT"
    assert data["vendor_status"] == "INCOMING"


@pytest.mark.asyncio
async def test_list_requests(client: AsyncClient, db_session: AsyncSession):
    token, _, _ = await _setup_lender_with_pricing(db_session)

    # Create a request first
    await client.post(
        "/api/lender/requests/",
        json={
            "report_category": "VALUATION",
            "property_address": "123 Main St",
            "city": "Mumbai",
            "area": "Andheri",
            "property_type": "RESIDENTIAL",
            "loan_applicant_name": "John Doe",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    response = await client.get(
        "/api/lender/requests/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


@pytest.mark.asyncio
async def test_get_eligible_vendors(client: AsyncClient, db_session: AsyncSession):
    token, _, _ = await _setup_lender_with_pricing(db_session)

    response = await client.get(
        "/api/lender/requests/vendors?city=Mumbai&area=Andheri&report_category=VALUATION",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Vendor"


@pytest.mark.asyncio
async def test_requires_lender_role(client: AsyncClient, db_session: AsyncSession):
    # Create a vendor user
    vendor_org = Organization(name="V", type=UserType.VENDOR)
    db_session.add(vendor_org)
    await db_session.flush()
    user = await user_service.create_user(
        db_session, email="vendor@test.com", mobile="9000000002",
        full_name="Vendor", password="test123",
        user_type=UserType.VENDOR, organization_id=vendor_org.id,
    )
    token = create_access_token(str(user.id))

    response = await client.get(
        "/api/lender/requests/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
