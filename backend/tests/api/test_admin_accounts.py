import pytest
from httpx import AsyncClient
from app.core.security import hash_password
from app.models.enums import UserType
from app.models.user import Organization, User


@pytest.fixture
async def admin_token(client: AsyncClient, db_session):
    org = Organization(name="GTR", type=UserType.ADMIN)
    db_session.add(org)
    await db_session.flush()
    admin = User(
        email="admin@test.com", mobile="9999900099", full_name="Admin",
        password_hash=hash_password("admin123"), user_type=UserType.ADMIN,
        organization_id=org.id,
    )
    db_session.add(admin)
    await db_session.flush()
    res = await client.post("/api/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_create_lender(client: AsyncClient, admin_token):
    res = await client.post(
        "/api/admin/lenders",
        json={"name": "Test Bank", "city": "Mumbai"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "Test Bank"


@pytest.mark.asyncio
async def test_list_lenders(client: AsyncClient, admin_token):
    res = await client.get(
        "/api/admin/lenders",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_create_vendor(client: AsyncClient, admin_token):
    res = await client.post(
        "/api/admin/vendors",
        json={"name": "Test Valuer", "office_city": "Delhi", "services": ["VALUATION"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "Test Valuer"


@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    res = await client.get("/api/admin/lenders")
    assert res.status_code == 403
