from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import LenderRole, UserType
from app.models.lender import Lender, LenderUser
from app.models.user import Organization, User
from app.services import user_service


async def _setup_admin_and_lender(db: AsyncSession) -> tuple[str, str]:
    """Create admin user + lender, return (admin_token, lender_id)."""
    admin_org = Organization(name="GTR", type=UserType.ADMIN)
    db.add(admin_org)
    await db.flush()
    admin = await user_service.create_user(
        db,
        email="admin@test.com",
        mobile="9000000001",
        full_name="Test Admin",
        password="test123",
        user_type=UserType.ADMIN,
        organization_id=admin_org.id,
    )
    admin_token = create_access_token(str(admin.id))

    lender_org = Organization(name="Test Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Test Bank", city="Mumbai")
    db.add(lender)
    await db.flush()

    return admin_token, str(lender.id)


@pytest.mark.asyncio
async def test_create_pricing_rule(client: AsyncClient, db_session: AsyncSession):
    token, lender_id = await _setup_admin_and_lender(db_session)
    response = await client.post(
        "/api/admin/pricing/rules",
        json={
            "lender_id": lender_id,
            "report_category": "VALUATION",
            "city": "Mumbai",
            "area": None,
            "property_type": "RESIDENTIAL",
            "new_request_price": "2500.00",
            "listing_download_price": "1500.00",
            "update_additional_price": "1000.00",
            "nearby_additional_price": "1000.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["city"] == "Mumbai"
    assert data["new_request_price"] == "2500.00"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_pricing_rules(client: AsyncClient, db_session: AsyncSession):
    token, lender_id = await _setup_admin_and_lender(db_session)
    await client.post(
        "/api/admin/pricing/rules",
        json={
            "lender_id": lender_id,
            "report_category": "VALUATION",
            "city": "Mumbai",
            "property_type": "RESIDENTIAL",
            "new_request_price": "2500.00",
            "listing_download_price": "1500.00",
            "update_additional_price": "1000.00",
            "nearby_additional_price": "1000.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    response = await client.get(
        f"/api/admin/pricing/rules?lender_id={lender_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


@pytest.mark.asyncio
async def test_update_pricing_rule(client: AsyncClient, db_session: AsyncSession):
    token, lender_id = await _setup_admin_and_lender(db_session)
    create_resp = await client.post(
        "/api/admin/pricing/rules",
        json={
            "lender_id": lender_id,
            "report_category": "VALUATION",
            "city": "Mumbai",
            "property_type": "RESIDENTIAL",
            "new_request_price": "2500.00",
            "listing_download_price": "1500.00",
            "update_additional_price": "1000.00",
            "nearby_additional_price": "1000.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    rule_id = create_resp.json()["id"]
    response = await client.put(
        f"/api/admin/pricing/rules/{rule_id}",
        json={"new_request_price": "3000.00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["new_request_price"] == "3000.00"


@pytest.mark.asyncio
async def test_delete_pricing_rule(client: AsyncClient, db_session: AsyncSession):
    token, lender_id = await _setup_admin_and_lender(db_session)
    create_resp = await client.post(
        "/api/admin/pricing/rules",
        json={
            "lender_id": lender_id,
            "report_category": "VALUATION",
            "city": "Mumbai",
            "property_type": "RESIDENTIAL",
            "new_request_price": "2500.00",
            "listing_download_price": "1500.00",
            "update_additional_price": "1000.00",
            "nearby_additional_price": "1000.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    rule_id = create_resp.json()["id"]
    response = await client.delete(
        f"/api/admin/pricing/rules/{rule_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    list_resp = await client.get(
        f"/api/admin/pricing/rules?lender_id={lender_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_calculate_price(client: AsyncClient, db_session: AsyncSession):
    token, lender_id = await _setup_admin_and_lender(db_session)
    await client.post(
        "/api/admin/pricing/rules",
        json={
            "lender_id": lender_id,
            "report_category": "VALUATION",
            "city": "Mumbai",
            "property_type": "RESIDENTIAL",
            "new_request_price": "2500.00",
            "listing_download_price": "1500.00",
            "update_additional_price": "1000.00",
            "nearby_additional_price": "1000.00",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    response = await client.get(
        f"/api/admin/pricing/calculate?lender_id={lender_id}&report_category=VALUATION&city=Mumbai&property_type=RESIDENTIAL&request_type=NEW",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == "2500.00"


@pytest.mark.asyncio
async def test_pricing_requires_admin(client: AsyncClient, db_session: AsyncSession):
    lender_org = Organization(name="Bank", type=UserType.LENDER)
    db_session.add(lender_org)
    await db_session.flush()
    lender_user = await user_service.create_user(
        db_session,
        email="lender@test.com",
        mobile="9000000002",
        full_name="Lender User",
        password="test123",
        user_type=UserType.LENDER,
        organization_id=lender_org.id,
    )
    token = create_access_token(str(lender_user.id))
    response = await client.get(
        "/api/admin/pricing/rules?lender_id=00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
