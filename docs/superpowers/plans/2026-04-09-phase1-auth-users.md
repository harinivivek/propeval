# Phase 1: Auth, Users & Account Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authentication (email+password, mobile+OTP), Lender/Vendor domain models, RBAC, account management APIs, and split-screen login UI.

**Architecture:** Backend follows 6-layer vertical slice (model → migration → schema → service → router → frontend). Auth uses JWT access+refresh tokens. OTP is mock (Redis-stored, console-logged). Three portals with RBAC. Admin creates all accounts (no self-signup).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, Redis (OTP store), Pydantic v2, python-jose, bcrypt, Next.js 15, Tailwind 4, shadcn/ui

---

## File Map

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/lender.py` | Lender, LenderBranch, LenderUser models |
| `backend/app/models/vendor.py` | Vendor, VendorUser, ServiceArea models |
| `backend/app/schemas/auth.py` | Login, OTP, token, password reset schemas |
| `backend/app/schemas/user.py` | User CRUD schemas |
| `backend/app/schemas/lender.py` | Lender/Branch/LenderUser schemas |
| `backend/app/schemas/vendor.py` | Vendor/VendorUser/ServiceArea schemas |
| `backend/app/services/auth_service.py` | Login, OTP, token refresh, password reset logic |
| `backend/app/services/otp_service.py` | Redis OTP store/verify, mock SMS |
| `backend/app/services/user_service.py` | User CRUD operations |
| `backend/app/services/lender_service.py` | Lender account management |
| `backend/app/services/vendor_service.py` | Vendor account management |
| `backend/app/api/auth.py` | Auth endpoints (login, OTP, refresh, reset) |
| `backend/app/api/admin/accounts.py` | Admin lender/vendor CRUD endpoints |
| `backend/app/api/lender/settings.py` | Lender user management endpoints |
| `backend/app/api/vendor/settings.py` | Vendor user management endpoints |
| `backend/scripts/seed.py` | Seed GTR admin + sample lender/vendor |
| `backend/tests/api/test_auth.py` | Auth endpoint tests |
| `backend/tests/api/test_admin_accounts.py` | Admin account management tests |
| `backend/tests/services/test_auth_service.py` | Auth service unit tests |

### Backend — Modified Files
| File | Changes |
|------|---------|
| `backend/app/models/__init__.py` | Register new models |
| `backend/app/main.py` | Register new routers |
| `backend/app/core/config.py` | Add DEV_OTP setting |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/types/auth.ts` | Auth request/response types |
| `frontend/src/types/user.ts` | User, Lender, Vendor types |
| `frontend/src/hooks/use-auth.ts` | Auth state hook (token, user, login/logout) |
| `frontend/src/app/(auth)/login/_components/login-form.tsx` | Tabbed login form (email + mobile) |
| `frontend/src/app/(auth)/login/_components/brand-panel.tsx` | Left split-screen branding |
| `frontend/src/app/(auth)/login/_components/portal-selector.tsx` | Dual-role portal picker |
| `frontend/src/components/ui/button.tsx` | shadcn Button |
| `frontend/src/components/ui/input.tsx` | shadcn Input |
| `frontend/src/components/ui/label.tsx` | shadcn Label |
| `frontend/src/components/ui/card.tsx` | shadcn Card |
| `frontend/src/components/ui/tabs.tsx` | shadcn Tabs |
| `frontend/src/app/admin/accounts/lenders/page.tsx` | Lender accounts table |
| `frontend/src/app/admin/accounts/vendors/page.tsx` | Vendor accounts table |
| `frontend/src/app/lender/settings/page.tsx` | Lender user management |
| `frontend/src/app/vendor/settings/page.tsx` | Vendor user management |

### Frontend — Modified Files
| File | Changes |
|------|---------|
| `frontend/src/app/(auth)/login/page.tsx` | Use new login components |
| `frontend/src/app/lender/layout.tsx` | Add settings nav link |
| `frontend/src/app/vendor/layout.tsx` | Add settings nav link |
| `frontend/src/app/admin/layout.tsx` | Add accounts nav links |

---

## Task 1: Lender & Vendor Domain Models

**Files:**
- Create: `backend/app/models/lender.py`
- Create: `backend/app/models/vendor.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Create lender.py model file**

```python
# backend/app/models/lender.py
import uuid

from sqlalchemy import Enum as SQLEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import LenderRole


class Lender(BaseModel):
    __tablename__ = "lenders"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)

    branches: Mapped[list["LenderBranch"]] = relationship(back_populates="lender")
    users: Mapped[list["LenderUser"]] = relationship(back_populates="lender")


class LenderBranch(BaseModel):
    __tablename__ = "lender_branches"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    name: Mapped[str] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)

    lender: Mapped[Lender] = relationship(back_populates="branches")


class LenderUser(BaseModel):
    __tablename__ = "lender_users"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    branch_ids: Mapped[list[str] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    role: Mapped[LenderRole] = mapped_column(SQLEnum(LenderRole))

    lender: Mapped[Lender] = relationship(back_populates="users")
```

- [ ] **Step 2: Create vendor.py model file**

```python
# backend/app/models/vendor.py
import uuid

from sqlalchemy import Enum as SQLEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ServiceType, VendorRole


class Vendor(BaseModel):
    __tablename__ = "vendors"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(255))
    office_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    office_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    services: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    users: Mapped[list["VendorUser"]] = relationship(back_populates="vendor")
    service_areas: Mapped[list["ServiceArea"]] = relationship(back_populates="vendor")


class VendorUser(BaseModel):
    __tablename__ = "vendor_users"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    role: Mapped[VendorRole] = mapped_column(SQLEnum(VendorRole))

    vendor: Mapped[Vendor] = relationship(back_populates="users")


class ServiceArea(BaseModel):
    __tablename__ = "service_areas"

    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    city: Mapped[str] = mapped_column(String(255))
    areas: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    service_type: Mapped[ServiceType] = mapped_column(SQLEnum(ServiceType))

    vendor: Mapped[Vendor] = relationship(back_populates="service_areas")
```

- [ ] **Step 3: Update models/__init__.py**

Add imports for all new models:
```python
from app.models.lender import Lender, LenderBranch, LenderUser
from app.models.vendor import ServiceArea, Vendor, VendorUser
```
And add them to `__all__`.

- [ ] **Step 4: Add DEV_OTP to config.py**

Add after OTP_EXPIRE_MINUTES line:
```python
    DEV_OTP: str = "123456"  # Fixed OTP accepted in local/dev environments
```

- [ ] **Step 5: Generate Alembic migration**

Run inside backend container:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic revision --autogenerate -m "add lender and vendor domain models"
```

- [ ] **Step 6: Run migration**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic upgrade head
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/lender.py backend/app/models/vendor.py backend/app/models/__init__.py backend/app/core/config.py backend/alembic/versions/
git commit -m "feat: add lender and vendor domain models (Phase 1A)"
```

---

## Task 2: Auth Schemas

**Files:**
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/user.py`

- [ ] **Step 1: Create auth.py schemas**

```python
# backend/app/schemas/auth.py
from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class OTPRequest(BaseModel):
    mobile: str


class OTPVerifyRequest(BaseModel):
    mobile: str
    otp: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str | None = None
    mobile: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    email: str
    mobile: str
    full_name: str
    user_type: str
    is_active: bool


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    is_dual_role: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
```

- [ ] **Step 2: Create user.py schemas**

```python
# backend/app/schemas/user.py
from uuid import UUID

from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    mobile: str
    full_name: str
    password: str
    user_type: str
    organization_id: UUID | None = None


class UserUpdate(BaseModel):
    email: str | None = None
    mobile: str | None = None
    full_name: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    email: str
    mobile: str
    full_name: str
    user_type: str
    is_active: bool
    organization_id: UUID | None = None
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/schemas/user.py
git commit -m "feat: add auth and user Pydantic schemas (Phase 1A)"
```

---

## Task 3: OTP Service (Mock)

**Files:**
- Create: `backend/app/services/otp_service.py`

- [ ] **Step 1: Create otp_service.py**

```python
# backend/app/services/otp_service.py
import logging
import random

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


async def send_otp(mobile: str) -> str:
    """Generate OTP, store in Redis, and mock-send via console log."""
    otp = generate_otp()
    r = await get_redis()
    await r.set(f"otp:{mobile}", otp, ex=settings.OTP_EXPIRE_MINUTES * 60)
    # Mock: log to console instead of sending SMS
    logger.info(f"[MOCK SMS] OTP for {mobile}: {otp}")
    return otp


async def verify_otp(mobile: str, otp: str) -> bool:
    """Verify OTP against Redis store. Accept DEV_OTP in local/dev."""
    if settings.APP_ENV in ("local", "dev") and otp == settings.DEV_OTP:
        return True
    r = await get_redis()
    stored = await r.get(f"otp:{mobile}")
    if stored and stored == otp:
        await r.delete(f"otp:{mobile}")
        return True
    return False
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/otp_service.py
git commit -m "feat: add mock OTP service with Redis store (Phase 1A)"
```

---

## Task 4: Auth Service

**Files:**
- Create: `backend/app/services/auth_service.py`

- [ ] **Step 1: Create auth_service.py**

```python
# backend/app/services/auth_service.py
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)
from app.models.user import User
from app.services.otp_service import send_otp, verify_otp


async def authenticate_email(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if user and verify_password(password, user.password_hash):
        return user
    return None


async def authenticate_otp(db: AsyncSession, mobile: str, otp: str) -> User | None:
    is_valid = await verify_otp(mobile, otp)
    if not is_valid:
        return None
    result = await db.execute(select(User).where(User.mobile == mobile, User.is_active == True))
    return result.scalar_one_or_none()


async def request_otp(db: AsyncSession, mobile: str) -> bool:
    result = await db.execute(select(User).where(User.mobile == mobile, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        return False
    await send_otp(mobile)
    return True


def generate_tokens(user: User) -> dict:
    access = create_access_token(str(user.id), [user.user_type])
    refresh = create_refresh_token(str(user.id))
    return {"access_token": access, "refresh_token": refresh}


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> dict | None:
    payload = verify_token(refresh_token)
    if payload.get("type") != "refresh":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == UUID(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        return None
    return {"access_token": create_access_token(str(user.id), [user.user_type])}


async def check_dual_role(db: AsyncSession, user: User) -> bool:
    """Check if user is associated with both lender and vendor orgs (GTR users)."""
    # For now, ADMIN users are considered dual-role capable
    return user.user_type == "ADMIN"


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_mobile(db: AsyncSession, mobile: str) -> User | None:
    result = await db.execute(select(User).where(User.mobile == mobile))
    return result.scalar_one_or_none()


async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
    payload = verify_token(token)
    if payload.get("type") != "reset":
        return False
    user_id = payload.get("sub")
    if not user_id:
        return False
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        return False
    user.password_hash = hash_password(new_password)
    await db.flush()
    return True
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/auth_service.py
git commit -m "feat: add auth service with email, OTP, and token logic (Phase 1A)"
```

---

## Task 5: Auth Router

**Files:**
- Create: `backend/app/api/auth.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create auth.py router**

```python
# backend/app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    OTPRequest,
    OTPVerifyRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_email(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    tokens = auth_service.generate_tokens(user)
    is_dual = await auth_service.check_dual_role(db, user)
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=UserResponse.model_validate(user),
        is_dual_role=is_dual,
    )


@router.post("/login-otp", response_model=MessageResponse)
async def request_login_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    sent = await auth_service.request_otp(db, body.mobile)
    if not sent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mobile number not registered")
    return MessageResponse(message="OTP sent successfully")


@router.post("/verify-otp", response_model=LoginResponse)
async def verify_login_otp(body: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_otp(db, body.mobile, body.otp)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")
    tokens = auth_service.generate_tokens(user)
    is_dual = await auth_service.check_dual_role(db, user)
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=UserResponse.model_validate(user),
        is_dual_role=is_dual,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await auth_service.refresh_access_token(db, body.refresh_token)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return TokenResponse(access_token=result["access_token"])


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    if body.email:
        user = await auth_service.get_user_by_email(db, body.email)
    elif body.mobile:
        user = await auth_service.get_user_by_mobile(db, body.mobile)
    else:
        raise HTTPException(status_code=400, detail="Provide email or mobile")
    if not user:
        # Don't reveal whether user exists
        return MessageResponse(message="If the account exists, a reset link has been sent")
    # In production: send email/SMS with reset token
    return MessageResponse(message="If the account exists, a reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    success = await auth_service.reset_password(db, body.token, body.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return MessageResponse(message="Password reset successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
```

- [ ] **Step 2: Register auth router in main.py**

Add after the health check endpoint:
```python
from app.api.auth import router as auth_router
app.include_router(auth_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/auth.py backend/app/main.py
git commit -m "feat: add auth router with login, OTP, refresh, reset endpoints (Phase 1A)"
```

---

## Task 6: User & Account Management Services

**Files:**
- Create: `backend/app/services/user_service.py`
- Create: `backend/app/services/lender_service.py`
- Create: `backend/app/services/vendor_service.py`

- [ ] **Step 1: Create user_service.py**

```python
# backend/app/services/user_service.py
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User


async def create_user(
    db: AsyncSession,
    email: str,
    mobile: str,
    full_name: str,
    password: str,
    user_type: str,
    organization_id: UUID | None = None,
) -> User:
    user = User(
        email=email,
        mobile=mobile,
        full_name=full_name,
        password_hash=hash_password(password),
        user_type=user_type,
        organization_id=organization_id,
    )
    db.add(user)
    await db.flush()
    return user


async def get_user(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: User, **kwargs) -> User:
    for key, value in kwargs.items():
        if value is not None and hasattr(user, key):
            setattr(user, key, value)
    await db.flush()
    return user


async def list_users_by_org(db: AsyncSession, organization_id: UUID) -> list[User]:
    result = await db.execute(
        select(User).where(User.organization_id == organization_id).order_by(User.created_at.desc())
    )
    return list(result.scalars().all())


async def deactivate_user(db: AsyncSession, user: User) -> User:
    user.is_active = False
    await db.flush()
    return user
```

- [ ] **Step 2: Create lender_service.py**

```python
# backend/app/services/lender_service.py
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.lender import Lender, LenderBranch, LenderUser
from app.models.user import Organization
from app.models.enums import UserType


async def create_lender(
    db: AsyncSession, name: str, city: str | None = None,
) -> Lender:
    org = Organization(name=name, type=UserType.LENDER, city=city)
    db.add(org)
    await db.flush()
    lender = Lender(organization_id=org.id, name=name, city=city)
    db.add(lender)
    await db.flush()
    return lender


async def get_lender(db: AsyncSession, lender_id: UUID) -> Lender | None:
    result = await db.execute(
        select(Lender)
        .options(selectinload(Lender.branches), selectinload(Lender.users))
        .where(Lender.id == lender_id)
    )
    return result.scalar_one_or_none()


async def list_lenders(db: AsyncSession) -> list[Lender]:
    result = await db.execute(select(Lender).order_by(Lender.created_at.desc()))
    return list(result.scalars().all())


async def update_lender(db: AsyncSession, lender: Lender, **kwargs) -> Lender:
    for key, value in kwargs.items():
        if value is not None and hasattr(lender, key):
            setattr(lender, key, value)
    await db.flush()
    return lender


async def create_branch(db: AsyncSession, lender_id: UUID, name: str, city: str | None = None) -> LenderBranch:
    branch = LenderBranch(lender_id=lender_id, name=name, city=city)
    db.add(branch)
    await db.flush()
    return branch


async def list_branches(db: AsyncSession, lender_id: UUID) -> list[LenderBranch]:
    result = await db.execute(
        select(LenderBranch).where(LenderBranch.lender_id == lender_id).order_by(LenderBranch.name)
    )
    return list(result.scalars().all())


async def create_lender_user(
    db: AsyncSession, user_id: UUID, lender_id: UUID, role: str, branch_ids: list[str] | None = None,
) -> LenderUser:
    lu = LenderUser(user_id=user_id, lender_id=lender_id, role=role, branch_ids=branch_ids)
    db.add(lu)
    await db.flush()
    return lu


async def list_lender_users(db: AsyncSession, lender_id: UUID) -> list[LenderUser]:
    result = await db.execute(
        select(LenderUser).where(LenderUser.lender_id == lender_id)
    )
    return list(result.scalars().all())
```

- [ ] **Step 3: Create vendor_service.py**

```python
# backend/app/services/vendor_service.py
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vendor import ServiceArea, Vendor, VendorUser
from app.models.user import Organization
from app.models.enums import UserType


async def create_vendor(
    db: AsyncSession, name: str, office_city: str | None = None,
    office_area: str | None = None, services: list[str] | None = None,
) -> Vendor:
    org = Organization(name=name, type=UserType.VENDOR, city=office_city)
    db.add(org)
    await db.flush()
    vendor = Vendor(
        organization_id=org.id, name=name,
        office_city=office_city, office_area=office_area, services=services,
    )
    db.add(vendor)
    await db.flush()
    return vendor


async def get_vendor(db: AsyncSession, vendor_id: UUID) -> Vendor | None:
    result = await db.execute(
        select(Vendor)
        .options(selectinload(Vendor.users), selectinload(Vendor.service_areas))
        .where(Vendor.id == vendor_id)
    )
    return result.scalar_one_or_none()


async def list_vendors(db: AsyncSession) -> list[Vendor]:
    result = await db.execute(select(Vendor).order_by(Vendor.created_at.desc()))
    return list(result.scalars().all())


async def update_vendor(db: AsyncSession, vendor: Vendor, **kwargs) -> Vendor:
    for key, value in kwargs.items():
        if value is not None and hasattr(vendor, key):
            setattr(vendor, key, value)
    await db.flush()
    return vendor


async def create_vendor_user(
    db: AsyncSession, user_id: UUID, vendor_id: UUID, role: str,
) -> VendorUser:
    vu = VendorUser(user_id=user_id, vendor_id=vendor_id, role=role)
    db.add(vu)
    await db.flush()
    return vu


async def list_vendor_users(db: AsyncSession, vendor_id: UUID) -> list[VendorUser]:
    result = await db.execute(
        select(VendorUser).where(VendorUser.vendor_id == vendor_id)
    )
    return list(result.scalars().all())


async def create_service_area(
    db: AsyncSession, vendor_id: UUID, city: str,
    areas: list[str] | None = None, service_type: str = "VALUATION",
) -> ServiceArea:
    sa = ServiceArea(vendor_id=vendor_id, city=city, areas=areas, service_type=service_type)
    db.add(sa)
    await db.flush()
    return sa


async def list_service_areas(db: AsyncSession, vendor_id: UUID) -> list[ServiceArea]:
    result = await db.execute(
        select(ServiceArea).where(ServiceArea.vendor_id == vendor_id)
    )
    return list(result.scalars().all())
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/user_service.py backend/app/services/lender_service.py backend/app/services/vendor_service.py
git commit -m "feat: add user, lender, vendor account management services (Phase 1B)"
```

---

## Task 7: Account Management Schemas

**Files:**
- Create: `backend/app/schemas/lender.py`
- Create: `backend/app/schemas/vendor.py`

- [ ] **Step 1: Create lender.py schemas**

```python
# backend/app/schemas/lender.py
from uuid import UUID

from pydantic import BaseModel


class LenderCreate(BaseModel):
    name: str
    city: str | None = None


class LenderUpdate(BaseModel):
    name: str | None = None
    city: str | None = None


class LenderResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    name: str
    city: str | None = None
    organization_id: UUID


class BranchCreate(BaseModel):
    name: str
    city: str | None = None


class BranchResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    lender_id: UUID
    name: str
    city: str | None = None


class LenderUserCreate(BaseModel):
    email: str
    mobile: str
    full_name: str
    password: str
    role: str
    branch_ids: list[str] | None = None


class LenderUserResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    user_id: UUID
    lender_id: UUID
    role: str
    branch_ids: list[str] | None = None
```

- [ ] **Step 2: Create vendor.py schemas**

```python
# backend/app/schemas/vendor.py
from uuid import UUID

from pydantic import BaseModel


class VendorCreate(BaseModel):
    name: str
    office_city: str | None = None
    office_area: str | None = None
    services: list[str] | None = None


class VendorUpdate(BaseModel):
    name: str | None = None
    office_city: str | None = None
    office_area: str | None = None
    services: list[str] | None = None


class VendorResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    name: str
    office_city: str | None = None
    office_area: str | None = None
    services: list[str] | None = None
    organization_id: UUID


class VendorUserCreate(BaseModel):
    email: str
    mobile: str
    full_name: str
    password: str
    role: str


class VendorUserResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    user_id: UUID
    vendor_id: UUID
    role: str


class ServiceAreaCreate(BaseModel):
    city: str
    areas: list[str] | None = None
    service_type: str = "VALUATION"


class ServiceAreaResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    vendor_id: UUID
    city: str
    areas: list[str] | None = None
    service_type: str
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/lender.py backend/app/schemas/vendor.py
git commit -m "feat: add lender and vendor Pydantic schemas (Phase 1B)"
```

---

## Task 8: Admin Account Management Router

**Files:**
- Create: `backend/app/api/admin/accounts.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create admin/accounts.py**

```python
# backend/app/api/admin/accounts.py
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import UserType
from app.models.user import User
from app.schemas.lender import (
    BranchCreate, BranchResponse, LenderCreate, LenderResponse,
    LenderUpdate, LenderUserCreate, LenderUserResponse,
)
from app.schemas.vendor import (
    ServiceAreaCreate, ServiceAreaResponse, VendorCreate, VendorResponse,
    VendorUpdate, VendorUserCreate, VendorUserResponse,
)
from app.services import lender_service, user_service, vendor_service

router = APIRouter(prefix="/api/admin", tags=["admin-accounts"])


# ---- Lenders ----

@router.get("/lenders", response_model=list[LenderResponse])
async def list_lenders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.list_lenders(db)


@router.post("/lenders", response_model=LenderResponse, status_code=status.HTTP_201_CREATED)
async def create_lender(
    body: LenderCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.create_lender(db, name=body.name, city=body.city)


@router.get("/lenders/{lender_id}", response_model=LenderResponse)
async def get_lender(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    lender = await lender_service.get_lender(db, lender_id)
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    return lender


@router.put("/lenders/{lender_id}", response_model=LenderResponse)
async def update_lender(
    lender_id: UUID,
    body: LenderUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    lender = await lender_service.get_lender(db, lender_id)
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    return await lender_service.update_lender(db, lender, **body.model_dump(exclude_unset=True))


@router.get("/lenders/{lender_id}/branches", response_model=list[BranchResponse])
async def list_branches(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.list_branches(db, lender_id)


@router.post("/lenders/{lender_id}/branches", response_model=BranchResponse, status_code=201)
async def create_branch(
    lender_id: UUID,
    body: BranchCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.create_branch(db, lender_id, name=body.name, city=body.city)


@router.get("/lenders/{lender_id}/users", response_model=list[LenderUserResponse])
async def list_lender_users(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.list_lender_users(db, lender_id)


@router.post("/lenders/{lender_id}/users", response_model=LenderUserResponse, status_code=201)
async def create_lender_user(
    lender_id: UUID,
    body: LenderUserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    lender = await lender_service.get_lender(db, lender_id)
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    user = await user_service.create_user(
        db, email=body.email, mobile=body.mobile, full_name=body.full_name,
        password=body.password, user_type=UserType.LENDER,
        organization_id=lender.organization_id,
    )
    return await lender_service.create_lender_user(
        db, user_id=user.id, lender_id=lender_id, role=body.role, branch_ids=body.branch_ids,
    )


# ---- Vendors ----

@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.list_vendors(db)


@router.post("/vendors", response_model=VendorResponse, status_code=201)
async def create_vendor(
    body: VendorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.create_vendor(
        db, name=body.name, office_city=body.office_city,
        office_area=body.office_area, services=body.services,
    )


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    vendor = await vendor_service.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: UUID,
    body: VendorUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    vendor = await vendor_service.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return await vendor_service.update_vendor(db, vendor, **body.model_dump(exclude_unset=True))


@router.get("/vendors/{vendor_id}/users", response_model=list[VendorUserResponse])
async def list_vendor_users(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.list_vendor_users(db, vendor_id)


@router.post("/vendors/{vendor_id}/users", response_model=VendorUserResponse, status_code=201)
async def create_vendor_user(
    vendor_id: UUID,
    body: VendorUserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    vendor = await vendor_service.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    user = await user_service.create_user(
        db, email=body.email, mobile=body.mobile, full_name=body.full_name,
        password=body.password, user_type=UserType.VENDOR,
        organization_id=vendor.organization_id,
    )
    return await vendor_service.create_vendor_user(db, user_id=user.id, vendor_id=vendor_id, role=body.role)


@router.get("/vendors/{vendor_id}/service-areas", response_model=list[ServiceAreaResponse])
async def list_service_areas(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.list_service_areas(db, vendor_id)


@router.post("/vendors/{vendor_id}/service-areas", response_model=ServiceAreaResponse, status_code=201)
async def create_service_area(
    vendor_id: UUID,
    body: ServiceAreaCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.create_service_area(
        db, vendor_id=vendor_id, city=body.city, areas=body.areas, service_type=body.service_type,
    )
```

- [ ] **Step 2: Register router in main.py**

Add after the auth router registration:
```python
from app.api.admin.accounts import router as admin_accounts_router
app.include_router(admin_accounts_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/admin/accounts.py backend/app/main.py
git commit -m "feat: add admin account management router for lenders and vendors (Phase 1B)"
```

---

## Task 9: Lender & Vendor Settings Routers

**Files:**
- Create: `backend/app/api/lender/settings.py`
- Create: `backend/app/api/vendor/settings.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create lender/settings.py**

```python
# backend/app/api/lender/settings.py
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import UserType
from app.models.user import User
from app.schemas.lender import LenderUserCreate, LenderUserResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services import lender_service, user_service

router = APIRouter(prefix="/api/lender/settings", tags=["lender-settings"])


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User not linked to organization")
    return await user_service.list_users_by_org(db, current_user.organization_id)


@router.post("/users", response_model=LenderUserResponse, status_code=201)
async def add_user(
    body: LenderUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User not linked to organization")
    # Find lender for this org
    from sqlalchemy import select
    from app.models.lender import Lender
    result = await db.execute(select(Lender).where(Lender.organization_id == current_user.organization_id))
    lender = result.scalar_one_or_none()
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    user = await user_service.create_user(
        db, email=body.email, mobile=body.mobile, full_name=body.full_name,
        password=body.password, user_type=UserType.LENDER,
        organization_id=current_user.organization_id,
    )
    return await lender_service.create_lender_user(
        db, user_id=user.id, lender_id=lender.id, role=body.role, branch_ids=body.branch_ids,
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    user = await user_service.get_user(db, user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    return await user_service.update_user(db, user, **body.model_dump(exclude_unset=True))


@router.delete("/users/{user_id}", response_model=UserResponse)
async def deactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    user = await user_service.get_user(db, user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    return await user_service.deactivate_user(db, user)
```

- [ ] **Step 2: Create vendor/settings.py**

```python
# backend/app/api/vendor/settings.py
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import UserType
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.vendor import VendorUserCreate, VendorUserResponse
from app.services import user_service, vendor_service

router = APIRouter(prefix="/api/vendor/settings", tags=["vendor-settings"])


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User not linked to organization")
    return await user_service.list_users_by_org(db, current_user.organization_id)


@router.post("/users", response_model=VendorUserResponse, status_code=201)
async def add_user(
    body: VendorUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User not linked to organization")
    from sqlalchemy import select
    from app.models.vendor import Vendor
    result = await db.execute(select(Vendor).where(Vendor.organization_id == current_user.organization_id))
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    user = await user_service.create_user(
        db, email=body.email, mobile=body.mobile, full_name=body.full_name,
        password=body.password, user_type=UserType.VENDOR,
        organization_id=current_user.organization_id,
    )
    return await vendor_service.create_vendor_user(db, user_id=user.id, vendor_id=vendor.id, role=body.role)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    user = await user_service.get_user(db, user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    return await user_service.update_user(db, user, **body.model_dump(exclude_unset=True))


@router.delete("/users/{user_id}", response_model=UserResponse)
async def deactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    user = await user_service.get_user(db, user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    return await user_service.deactivate_user(db, user)
```

- [ ] **Step 3: Register both routers in main.py**

Add after admin router registration:
```python
from app.api.lender.settings import router as lender_settings_router
from app.api.vendor.settings import router as vendor_settings_router
app.include_router(lender_settings_router)
app.include_router(vendor_settings_router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/lender/settings.py backend/app/api/vendor/settings.py backend/app/main.py
git commit -m "feat: add lender and vendor settings routers for user management (Phase 1B)"
```

---

## Task 10: Seed Script

**Files:**
- Create: `backend/scripts/__init__.py`
- Create: `backend/scripts/seed.py`

- [ ] **Step 1: Create seed script**

```python
# backend/scripts/__init__.py
```

```python
# backend/scripts/seed.py
import asyncio

from app.core.database import get_async_session_context
from app.core.security import hash_password
from app.models.enums import LenderRole, ServiceType, UserType, VendorRole
from app.models.lender import Lender, LenderBranch, LenderUser
from app.models.user import Organization, User
from app.models.vendor import ServiceArea, Vendor, VendorUser


async def seed():
    async with get_async_session_context() as db:
        # 1. GTR Admin
        admin_org = Organization(name="Get It Right", type=UserType.ADMIN, city="Bengaluru")
        db.add(admin_org)
        await db.flush()

        admin_user = User(
            email="admin@getitright.com",
            mobile="9999900000",
            full_name="GTR Admin",
            password_hash=hash_password("admin123"),
            user_type=UserType.ADMIN,
            organization_id=admin_org.id,
        )
        db.add(admin_user)
        await db.flush()
        print(f"Created GTR Admin: admin@getitright.com / admin123")

        # 2. Sample Lender
        lender_org = Organization(name="ABCL Bank", type=UserType.LENDER, city="Bengaluru")
        db.add(lender_org)
        await db.flush()

        lender = Lender(organization_id=lender_org.id, name="ABCL Bank", city="Bengaluru")
        db.add(lender)
        await db.flush()

        branch = LenderBranch(lender_id=lender.id, name="Koramangala Branch", city="Bengaluru")
        db.add(branch)
        await db.flush()

        lender_user = User(
            email="lender@abcl.com",
            mobile="9999900001",
            full_name="ABCL Lender User",
            password_hash=hash_password("lender123"),
            user_type=UserType.LENDER,
            organization_id=lender_org.id,
        )
        db.add(lender_user)
        await db.flush()

        lender_user_link = LenderUser(
            user_id=lender_user.id, lender_id=lender.id,
            role=LenderRole.ORG_ADMIN, branch_ids=[str(branch.id)],
        )
        db.add(lender_user_link)
        print(f"Created Lender User: lender@abcl.com / lender123")

        # 3. Sample Vendor
        vendor_org = Organization(name="ValuePro Consultants", type=UserType.VENDOR, city="Bengaluru")
        db.add(vendor_org)
        await db.flush()

        vendor = Vendor(
            organization_id=vendor_org.id, name="ValuePro Consultants",
            office_city="Bengaluru", office_area="Koramangala",
            services=[ServiceType.VALUATION, ServiceType.LEGAL],
        )
        db.add(vendor)
        await db.flush()

        service_area = ServiceArea(
            vendor_id=vendor.id, city="Bengaluru",
            areas=["Koramangala", "HSR Layout", "BTM Layout"],
            service_type=ServiceType.VALUATION,
        )
        db.add(service_area)

        vendor_user = User(
            email="vendor@valuepro.com",
            mobile="9999900002",
            full_name="ValuePro Vendor",
            password_hash=hash_password("vendor123"),
            user_type=UserType.VENDOR,
            organization_id=vendor_org.id,
        )
        db.add(vendor_user)
        await db.flush()

        vendor_user_link = VendorUser(
            user_id=vendor_user.id, vendor_id=vendor.id, role=VendorRole.VENDOR_ADMIN,
        )
        db.add(vendor_user_link)
        print(f"Created Vendor User: vendor@valuepro.com / vendor123")

        print("\nSeed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/
git commit -m "feat: add seed script with GTR admin, sample lender, and vendor (Phase 1B)"
```

---

## Task 11: Frontend — shadcn/ui Components + Auth Types

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/label.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/tabs.tsx`
- Create: `frontend/src/types/auth.ts`
- Create: `frontend/src/types/user.ts`
- Create: `frontend/src/hooks/use-auth.ts`

- [ ] **Step 1: Install shadcn/ui components**

Run inside the frontend container:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec frontend npx shadcn@latest init -y
docker compose -f docker-compose.local.yml --env-file .env.local exec frontend npx shadcn@latest add button input label card tabs
```

If shadcn CLI is not available in container, create the component files manually following shadcn/ui patterns.

- [ ] **Step 2: Create auth types**

```typescript
// frontend/src/types/auth.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface OTPRequest {
  mobile: string;
}

export interface OTPVerifyRequest {
  mobile: string;
  otp: string;
}

export interface UserResponse {
  id: string;
  email: string;
  mobile: string;
  full_name: string;
  user_type: "LENDER" | "VENDOR" | "ADMIN";
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserResponse;
  is_dual_role: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
```

- [ ] **Step 3: Create user types**

```typescript
// frontend/src/types/user.ts
export interface Lender {
  id: string;
  name: string;
  city: string | null;
  organization_id: string;
}

export interface LenderBranch {
  id: string;
  lender_id: string;
  name: string;
  city: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  office_city: string | null;
  office_area: string | null;
  services: string[] | null;
  organization_id: string;
}

export interface UserCreate {
  email: string;
  mobile: string;
  full_name: string;
  password: string;
  role: string;
  branch_ids?: string[];
}
```

- [ ] **Step 4: Create use-auth hook**

```typescript
// frontend/src/hooks/use-auth.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LoginResponse, UserResponse } from "@/types/auth";

export function useAuth() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      api
        .get<UserResponse>("/api/auth/me")
        .then(setUser)
        .catch(() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (response: LoginResponse) => {
    localStorage.setItem("access_token", response.access_token);
    localStorage.setItem("refresh_token", response.refresh_token);
    setUser(response.user);
    return response;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    window.location.href = "/login";
  }, []);

  return { user, loading, login, logout };
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/ frontend/src/hooks/use-auth.ts frontend/src/components/ui/
git commit -m "feat: add frontend auth types, use-auth hook, and shadcn/ui components (Phase 1A)"
```

---

## Task 12: Frontend — Split-Screen Login Page

**Files:**
- Create: `frontend/src/app/(auth)/login/_components/brand-panel.tsx`
- Create: `frontend/src/app/(auth)/login/_components/login-form.tsx`
- Create: `frontend/src/app/(auth)/login/_components/portal-selector.tsx`
- Modify: `frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create brand-panel.tsx**

```tsx
// frontend/src/app/(auth)/login/_components/brand-panel.tsx
export function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-center items-center p-12">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">PropEval</h1>
        <p className="text-xl text-slate-300">
          Property Valuation & Legal Reports Marketplace
        </p>
        <div className="w-24 h-1 bg-blue-500 mx-auto rounded" />
        <p className="text-sm text-slate-400 leading-relaxed">
          Connecting lenders with property valuers and legal experts.
          Request, review, and manage property valuation and legal due
          diligence reports — all in one place.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create login-form.tsx**

```tsx
// frontend/src/app/(auth)/login/_components/login-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { LoginResponse } from "@/types/auth";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [tab, setTab] = useState<"email" | "mobile">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Email login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Mobile OTP state
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/api/auth/login", {
        email,
        password,
      });
      const data = await login(res);
      if (data.is_dual_role) {
        router.push("/portal-select");
        return;
      }
      const routes: Record<string, string> = {
        LENDER: "/lender/dashboard",
        VENDOR: "/vendor/dashboard",
        ADMIN: "/admin/dashboard",
      };
      router.push(routes[data.user.user_type] || "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await api.post("/api/auth/login-otp", { mobile });
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/api/auth/verify-otp", {
        mobile,
        otp,
      });
      const data = await login(res);
      if (data.is_dual_role) {
        router.push("/portal-select");
        return;
      }
      const routes: Record<string, string> = {
        LENDER: "/lender/dashboard",
        VENDOR: "/vendor/dashboard",
        ADMIN: "/admin/dashboard",
      };
      router.push(routes[data.user.user_type] || "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold">Sign in</h2>
        <p className="text-sm text-gray-500 mt-1">
          Access your PropEval account
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "email"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setTab("email")}
        >
          Email
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "mobile"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500"
          }`}
          onClick={() => setTab("mobile")}
        >
          Mobile
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Email Tab */}
      {tab === "email" && (
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>
          <div className="text-right">
            <a href="#" className="text-sm text-blue-600 hover:underline">
              Forgot password?
            </a>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      )}

      {/* Mobile Tab */}
      {tab === "mobile" && (
        <form onSubmit={handleOtpVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Mobile Number
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="9876543210"
                required
              />
              {!otpSent && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || !mobile}
                  className="px-4 py-2 bg-gray-100 border rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  Send OTP
                </button>
              )}
            </div>
          </div>
          {otpSent && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123456"
                  maxLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Sign in"}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create portal-selector.tsx**

```tsx
// frontend/src/app/(auth)/login/_components/portal-selector.tsx
"use client";

import { useRouter } from "next/navigation";

export function PortalSelector() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md w-full p-8 space-y-6 text-center">
        <h2 className="text-2xl font-bold">Select Portal</h2>
        <p className="text-gray-500">Choose which portal to access</p>
        <div className="space-y-3">
          <button
            onClick={() => router.push("/lender/dashboard")}
            className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="font-medium">Lender Portal</div>
            <div className="text-sm text-gray-500">
              Request and manage property reports
            </div>
          </button>
          <button
            onClick={() => router.push("/vendor/dashboard")}
            className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="font-medium">Vendor Portal</div>
            <div className="text-sm text-gray-500">
              Upload and manage your reports
            </div>
          </button>
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="font-medium">Admin Portal</div>
            <div className="text-sm text-gray-500">
              Manage accounts and platform settings
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update login/page.tsx**

```tsx
// frontend/src/app/(auth)/login/page.tsx
import { BrandPanel } from "./_components/brand-panel";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      <BrandPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/\(auth\)/login/
git commit -m "feat: add split-screen login page with email and OTP tabs (Phase 1A)"
```

---

## Task 13: Frontend — Admin Account Pages + Settings Pages

**Files:**
- Create: `frontend/src/app/admin/accounts/lenders/page.tsx`
- Create: `frontend/src/app/admin/accounts/vendors/page.tsx`
- Create: `frontend/src/app/lender/settings/page.tsx`
- Create: `frontend/src/app/vendor/settings/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`
- Modify: `frontend/src/app/lender/layout.tsx`
- Modify: `frontend/src/app/vendor/layout.tsx`

- [ ] **Step 1: Create admin lenders page**

```tsx
// frontend/src/app/admin/accounts/lenders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Lender } from "@/types/user";

export default function LendersPage() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    api.get<Lender[]>("/api/admin/lenders").then(setLenders);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const lender = await api.post<Lender>("/api/admin/lenders", { name, city });
    setLenders([lender, ...lenders]);
    setShowForm(false);
    setName("");
    setCity("");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lender Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Add Lender
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border rounded-lg space-y-3">
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Lender name" required
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <input
            type="text" value={city} onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm">
            Create
          </button>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">City</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {lenders.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="p-3">{l.name}</td>
              <td className="p-3">{l.city || "—"}</td>
              <td className="p-3">
                <a href={`/admin/accounts/lenders/${l.id}`} className="text-blue-600 hover:underline text-sm">
                  Manage
                </a>
              </td>
            </tr>
          ))}
          {lenders.length === 0 && (
            <tr><td colSpan={3} className="p-3 text-center text-gray-400">No lenders yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create admin vendors page** (same pattern as lenders — adapted for vendor fields)

```tsx
// frontend/src/app/admin/accounts/vendors/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Vendor } from "@/types/user";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeArea, setOfficeArea] = useState("");

  useEffect(() => {
    api.get<Vendor[]>("/api/admin/vendors").then(setVendors);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendor = await api.post<Vendor>("/api/admin/vendors", {
      name, office_city: officeCity, office_area: officeArea,
      services: ["VALUATION"],
    });
    setVendors([vendor, ...vendors]);
    setShowForm(false);
    setName("");
    setOfficeCity("");
    setOfficeArea("");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vendor Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Add Vendor
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border rounded-lg space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Vendor name" required className="w-full px-3 py-2 border rounded-md text-sm" />
          <input type="text" value={officeCity} onChange={(e) => setOfficeCity(e.target.value)}
            placeholder="City" className="w-full px-3 py-2 border rounded-md text-sm" />
          <input type="text" value={officeArea} onChange={(e) => setOfficeArea(e.target.value)}
            placeholder="Area" className="w-full px-3 py-2 border rounded-md text-sm" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm">Create</button>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">City</th>
            <th className="text-left p-3">Area</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id} className="border-t">
              <td className="p-3">{v.name}</td>
              <td className="p-3">{v.office_city || "—"}</td>
              <td className="p-3">{v.office_area || "—"}</td>
              <td className="p-3">
                <a href={`/admin/accounts/vendors/${v.id}`} className="text-blue-600 hover:underline text-sm">Manage</a>
              </td>
            </tr>
          ))}
          {vendors.length === 0 && (
            <tr><td colSpan={4} className="p-3 text-center text-gray-400">No vendors yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create lender settings page**

```tsx
// frontend/src/app/lender/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/auth";

export default function LenderSettingsPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);

  useEffect(() => {
    api.get<UserResponse[]>("/api/lender/settings/users").then(setUsers);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings — User Management</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Email</th>
            <th className="text-left p-3">Mobile</th>
            <th className="text-left p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-3">{u.full_name}</td>
              <td className="p-3">{u.email}</td>
              <td className="p-3">{u.mobile}</td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded text-xs ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create vendor settings page**

```tsx
// frontend/src/app/vendor/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/auth";

export default function VendorSettingsPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);

  useEffect(() => {
    api.get<UserResponse[]>("/api/vendor/settings/users").then(setUsers);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings — User Management</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Email</th>
            <th className="text-left p-3">Mobile</th>
            <th className="text-left p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-3">{u.full_name}</td>
              <td className="p-3">{u.email}</td>
              <td className="p-3">{u.mobile}</td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded text-xs ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Update layout files with new nav links**

Update `frontend/src/app/admin/layout.tsx` — add nav links:
```tsx
<a href="/admin/accounts/lenders" className="block p-2 rounded hover:bg-gray-100">Lenders</a>
<a href="/admin/accounts/vendors" className="block p-2 rounded hover:bg-gray-100">Vendors</a>
```

Update `frontend/src/app/lender/layout.tsx` — add:
```tsx
<a href="/lender/settings" className="block p-2 rounded hover:bg-gray-100">Settings</a>
```

Update `frontend/src/app/vendor/layout.tsx` — add:
```tsx
<a href="/vendor/settings" className="block p-2 rounded hover:bg-gray-100">Settings</a>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/admin/accounts/ frontend/src/app/lender/settings/ frontend/src/app/vendor/settings/ frontend/src/app/admin/layout.tsx frontend/src/app/lender/layout.tsx frontend/src/app/vendor/layout.tsx
git commit -m "feat: add admin account pages and lender/vendor settings pages (Phase 1B)"
```

---

## Task 14: Backend Tests

**Files:**
- Create: `backend/tests/api/test_auth.py`
- Create: `backend/tests/api/test_admin_accounts.py`
- Create: `backend/tests/services/__init__.py`
- Create: `backend/tests/services/test_auth_service.py`

- [ ] **Step 1: Create test_auth.py**

```python
# backend/tests/api/test_auth.py
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
        email="test@example.com",
        mobile="9999911111",
        full_name="Test User",
        password_hash=hash_password("testpass"),
        user_type=UserType.LENDER,
        organization_id=org.id,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, seeded_user):
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpass",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, seeded_user):
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpass",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, seeded_user):
    login_res = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpass",
    })
    token = login_res.json()["access_token"]
    me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    response = await client.get("/api/auth/me")
    assert response.status_code == 403
```

- [ ] **Step 2: Create test_admin_accounts.py**

```python
# backend/tests/api/test_admin_accounts.py
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
        email="admin@test.com",
        mobile="9999900099",
        full_name="Admin",
        password_hash=hash_password("admin123"),
        user_type=UserType.ADMIN,
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
```

- [ ] **Step 3: Create services test directory and auth service test**

```python
# backend/tests/services/__init__.py
```

```python
# backend/tests/services/test_auth_service.py
import pytest

from app.core.security import hash_password, verify_password, create_access_token, verify_token


def test_password_hash_and_verify():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_verify_token():
    token = create_access_token("test-user-id", ["LENDER"])
    payload = verify_token(token)
    assert payload["sub"] == "test-user-id"
    assert "LENDER" in payload["roles"]


def test_verify_invalid_token():
    payload = verify_token("invalid.token.here")
    assert payload == {}
```

- [ ] **Step 4: Run tests**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend pytest -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/
git commit -m "feat: add auth and admin account management tests (Phase 1)"
```

---

## Summary

| Task | Description | Commit message |
|------|-------------|---------------|
| 1 | Lender/Vendor models + migration | `feat: add lender and vendor domain models (Phase 1A)` |
| 2 | Auth + user schemas | `feat: add auth and user Pydantic schemas (Phase 1A)` |
| 3 | Mock OTP service | `feat: add mock OTP service with Redis store (Phase 1A)` |
| 4 | Auth service | `feat: add auth service with email, OTP, and token logic (Phase 1A)` |
| 5 | Auth router | `feat: add auth router with login, OTP, refresh, reset endpoints (Phase 1A)` |
| 6 | User/Lender/Vendor services | `feat: add user, lender, vendor account management services (Phase 1B)` |
| 7 | Lender/Vendor schemas | `feat: add lender and vendor Pydantic schemas (Phase 1B)` |
| 8 | Admin accounts router | `feat: add admin account management router (Phase 1B)` |
| 9 | Lender/Vendor settings routers | `feat: add lender and vendor settings routers (Phase 1B)` |
| 10 | Seed script | `feat: add seed script with GTR admin, sample lender, and vendor (Phase 1B)` |
| 11 | Frontend types + auth hook + shadcn | `feat: add frontend auth types, use-auth hook, shadcn/ui (Phase 1A)` |
| 12 | Split-screen login page | `feat: add split-screen login page with email and OTP tabs (Phase 1A)` |
| 13 | Admin/Settings frontend pages | `feat: add admin account pages and settings pages (Phase 1B)` |
| 14 | Backend tests | `feat: add auth and admin account management tests (Phase 1)` |
