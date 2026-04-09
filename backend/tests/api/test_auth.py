import pytest
from httpx import AsyncClient
from app.core.security import hash_password
from app.models.enums import UserType
from app.models.user import Organization, User


@pytest.fixture
async def seeded_user(db_session):
    org = Organization(name="Test Org", type=UserType.LENDER)
    db_session.add(org)
    await db_session.flush()
    user = User(
        email="test@example.com", mobile="9999911111", full_name="Test User",
        password_hash=hash_password("testpass"), user_type=UserType.LENDER,
        organization_id=org.id,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, seeded_user):
    response = await client.post("/api/auth/login", json={"email": "test@example.com", "password": "testpass"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, seeded_user):
    response = await client.post("/api/auth/login", json={"email": "test@example.com", "password": "wrongpass"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, seeded_user):
    login_res = await client.post("/api/auth/login", json={"email": "test@example.com", "password": "testpass"})
    token = login_res.json()["access_token"]
    me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    response = await client.get("/api/auth/me")
    assert response.status_code == 403
