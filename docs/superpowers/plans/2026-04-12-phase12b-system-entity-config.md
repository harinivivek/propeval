# Phase 12B: System & Entity Configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make broadcast, acceptance, listing, and upload parameters configurable via admin/vendor/lender settings UIs, with live workflow integration.

**Architecture:** Five new DB models (SystemConfig, VendorConfig, LenderConfig, LenderVendorPreference, VendorLenderExclusion) with 1:1 and mapping relationships. System config cached in Redis (60s TTL). Three new service modules. Three new API routers. Three frontend settings page/tab additions. Four workflow wiring points in existing services.

**Tech Stack:** SQLAlchemy 2.0 async models, FastAPI routers, Pydantic v2 schemas, Redis (aioredis), Next.js/React/TypeScript, Tailwind + shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-12-phase12b-system-entity-config-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/models/system_config.py` | SystemConfig model (single-row global params) |
| `backend/app/models/vendor_config.py` | VendorConfig + VendorLenderExclusion models |
| `backend/app/models/lender_config.py` | LenderConfig + LenderVendorPreference models |
| `backend/app/schemas/system_config.py` | SystemConfig request/response schemas |
| `backend/app/schemas/vendor_config.py` | VendorConfig + exclusion schemas |
| `backend/app/schemas/lender_config.py` | LenderConfig + preference schemas |
| `backend/app/services/system_config_service.py` | System config CRUD + Redis cache |
| `backend/app/services/vendor_config_service.py` | Vendor config + exclusion CRUD |
| `backend/app/services/lender_config_service.py` | Lender config + preference CRUD |
| `backend/app/api/admin/system_config.py` | Admin system config endpoints (GET/PUT) |
| `backend/app/api/vendor/config.py` | Vendor config + exclusion endpoints |
| `backend/app/api/lender/config.py` | Lender config + preference endpoints |
| `frontend/src/types/config.ts` | Config TypeScript types |
| `frontend/src/app/admin/settings/page.tsx` | Admin system config page |
| `frontend/src/app/admin/settings/_components/system-config-form.tsx` | System config form component |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Register 5 new models |
| `backend/app/models/enums.py` | Add SYSTEM_CONFIG_UPDATED, REPORT_AUTO_APPROVED activity enums |
| `backend/app/main.py` | Register 3 new routers |
| `backend/app/services/broadcast_service.py` | Read config from DB + price threshold filter |
| `backend/app/services/request_service.py` | Auto-approve check + auto-listing trigger |
| `backend/app/services/listing_service.py` | Exclusion filter in browse query |
| `backend/app/services/report_service.py` | Read max_upload_size_mb from config |
| `backend/app/api/lender/listings.py` | Pass lender_id to browse for exclusion filter |
| `frontend/src/app/vendor/settings/page.tsx` | Add Configuration tab |
| `frontend/src/app/lender/settings/page.tsx` | Add Configuration tab |
| `frontend/src/app/admin/layout.tsx` | Add Settings nav link |

---

### Task 1: New Models + Enums + Migration

**Files:**
- Create: `backend/app/models/system_config.py`
- Create: `backend/app/models/vendor_config.py`
- Create: `backend/app/models/lender_config.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/enums.py`

- [ ] **Step 1: Create SystemConfig model**

Create `backend/app/models/system_config.py`:

```python
import uuid

from sqlalchemy import ARRAY, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class SystemConfig(BaseModel):
    __tablename__ = "system_config"

    vendors_per_broadcast_round: Mapped[int] = mapped_column(Integer, default=5)
    broadcast_accept_window_minutes: Mapped[int] = mapped_column(Integer, default=30)
    auto_accept_days: Mapped[int] = mapped_column(Integer, default=7)
    max_upload_size_mb: Mapped[int] = mapped_column(Integer, default=20)
    required_report_fields: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
```

- [ ] **Step 2: Create VendorConfig + VendorLenderExclusion models**

Create `backend/app/models/vendor_config.py`:

```python
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class VendorConfig(BaseModel):
    __tablename__ = "vendor_config"
    __table_args__ = (
        UniqueConstraint("vendor_id", name="uq_vendor_config_vendor"),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    auto_listing_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    price_threshold: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    separate_valuation_legal: Mapped[bool] = mapped_column(Boolean, default=False)


class VendorLenderExclusion(BaseModel):
    __tablename__ = "vendor_lender_exclusions"
    __table_args__ = (
        UniqueConstraint("vendor_id", "lender_id", name="uq_vendor_lender_exclusion"),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    lender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lenders.id"), index=True
    )
```

- [ ] **Step 3: Create LenderConfig + LenderVendorPreference models**

Create `backend/app/models/lender_config.py`:

```python
import uuid

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class LenderConfig(BaseModel):
    __tablename__ = "lender_config"
    __table_args__ = (
        UniqueConstraint("lender_id", name="uq_lender_config_lender"),
    )

    lender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lenders.id"), index=True
    )


class LenderVendorPreference(BaseModel):
    __tablename__ = "lender_vendor_preferences"
    __table_args__ = (
        UniqueConstraint("lender_id", "vendor_id", name="uq_lender_vendor_pref"),
    )

    lender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lenders.id"), index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False)
```

- [ ] **Step 4: Add new enum values**

In `backend/app/models/enums.py`, add to `ActivityAction` (after INVOICE_STATUS_UPDATED):

```python
    SYSTEM_CONFIG_UPDATED = "SYSTEM_CONFIG_UPDATED"
    REPORT_AUTO_APPROVED = "REPORT_AUTO_APPROVED"
```

Add to `ActivityTargetType` (after INVOICE):

```python
    SYSTEM_CONFIG = "SYSTEM_CONFIG"
```

- [ ] **Step 5: Register models in `__init__.py`**

In `backend/app/models/__init__.py`, add imports:

```python
from app.models.system_config import SystemConfig
from app.models.vendor_config import VendorConfig, VendorLenderExclusion
from app.models.lender_config import LenderConfig, LenderVendorPreference
```

Add to `__all__`:

```python
    # Phase 12B — Config
    "SystemConfig",
    "VendorConfig",
    "VendorLenderExclusion",
    "LenderConfig",
    "LenderVendorPreference",
```

- [ ] **Step 6: Generate and run migration**

```bash
docker compose -f docker-compose.local.yml exec backend alembic revision --autogenerate -m "add config tables for phase 12b"
docker compose -f docker-compose.local.yml exec backend alembic upgrade head
```

Copy migration to host:

```bash
docker cp propeval-backend-1:/app/alembic/versions/<generated_file>.py backend/alembic/versions/
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/system_config.py backend/app/models/vendor_config.py backend/app/models/lender_config.py backend/app/models/__init__.py backend/app/models/enums.py backend/alembic/versions/
git commit -m "feat(phase12b): add config models, enums, and migration"
```

---

### Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/system_config.py`
- Create: `backend/app/schemas/vendor_config.py`
- Create: `backend/app/schemas/lender_config.py`

- [ ] **Step 1: Create system config schemas**

Create `backend/app/schemas/system_config.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SystemConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendors_per_broadcast_round: int
    broadcast_accept_window_minutes: int
    auto_accept_days: int
    max_upload_size_mb: int
    required_report_fields: list[str] | None
    updated_by: UUID | None
    updated_at: datetime


class SystemConfigUpdate(BaseModel):
    vendors_per_broadcast_round: int | None = None
    broadcast_accept_window_minutes: int | None = None
    auto_accept_days: int | None = None
    max_upload_size_mb: int | None = None
    required_report_fields: list[str] | None = None
```

- [ ] **Step 2: Create vendor config schemas**

Create `backend/app/schemas/vendor_config.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VendorConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    auto_listing_enabled: bool
    price_threshold: str | None = None
    separate_valuation_legal: bool


class VendorConfigUpdate(BaseModel):
    auto_listing_enabled: bool | None = None
    price_threshold: str | None = None
    separate_valuation_legal: bool | None = None


class ExclusionEntry(BaseModel):
    lender_id: UUID
    lender_name: str
    created_at: datetime


class VendorConfigWithExclusions(BaseModel):
    config: VendorConfigResponse
    exclusions: list[ExclusionEntry]


class AddExclusionRequest(BaseModel):
    lender_id: UUID
```

- [ ] **Step 3: Create lender config schemas**

Create `backend/app/schemas/lender_config.py`:

```python
from uuid import UUID

from pydantic import BaseModel


class LenderConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID


class VendorPreferenceEntry(BaseModel):
    vendor_id: UUID
    vendor_name: str
    auto_approve: bool


class LenderConfigWithPreferences(BaseModel):
    config: LenderConfigResponse
    vendor_preferences: list[VendorPreferenceEntry]


class SetVendorPreferenceRequest(BaseModel):
    auto_approve: bool
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/system_config.py backend/app/schemas/vendor_config.py backend/app/schemas/lender_config.py
git commit -m "feat(phase12b): add config Pydantic schemas"
```

---

### Task 3: System Config Service (with Redis Cache)

**Files:**
- Create: `backend/app/services/system_config_service.py`

- [ ] **Step 1: Create system config service**

Create `backend/app/services/system_config_service.py`:

```python
import json
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import (
    AUTO_ACCEPT_DAYS,
    MAX_UPLOAD_SIZE_MB,
    REQUIRED_REPORT_FIELDS,
    VENDORS_PER_BROADCAST_ROUND,
    BROADCAST_ACCEPT_WINDOW_MINUTES,
)
from app.models.system_config import SystemConfig

CACHE_KEY = "system_config"
CACHE_TTL = 60  # seconds

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _serialize(config: SystemConfig) -> str:
    return json.dumps({
        "id": str(config.id),
        "vendors_per_broadcast_round": config.vendors_per_broadcast_round,
        "broadcast_accept_window_minutes": config.broadcast_accept_window_minutes,
        "auto_accept_days": config.auto_accept_days,
        "max_upload_size_mb": config.max_upload_size_mb,
        "required_report_fields": config.required_report_fields,
        "updated_by": str(config.updated_by) if config.updated_by else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    })


async def _get_from_cache() -> dict | None:
    r = await _get_redis()
    data = await r.get(CACHE_KEY)
    if data:
        return json.loads(data)
    return None


async def _set_cache(config: SystemConfig) -> None:
    r = await _get_redis()
    await r.set(CACHE_KEY, _serialize(config), ex=CACHE_TTL)


async def _invalidate_cache() -> None:
    r = await _get_redis()
    await r.delete(CACHE_KEY)


async def get_system_config(db: AsyncSession) -> SystemConfig:
    """Get system config from DB (cache is used by get_config_values for perf)."""
    result = await db.execute(select(SystemConfig).limit(1))
    config = result.scalar_one_or_none()
    if config is None:
        config = SystemConfig(
            vendors_per_broadcast_round=VENDORS_PER_BROADCAST_ROUND,
            broadcast_accept_window_minutes=BROADCAST_ACCEPT_WINDOW_MINUTES,
            auto_accept_days=AUTO_ACCEPT_DAYS,
            max_upload_size_mb=MAX_UPLOAD_SIZE_MB,
            required_report_fields=list(REQUIRED_REPORT_FIELDS),
        )
        db.add(config)
        await db.flush()
    await _set_cache(config)
    return config


async def get_config_values() -> dict:
    """Get config as dict — uses Redis cache, falls back to defaults.

    Use this in services that only need values (no DB session needed for cache hit).
    """
    cached = await _get_from_cache()
    if cached:
        return cached
    # Cache miss without DB — return defaults (next DB read will populate cache)
    return {
        "vendors_per_broadcast_round": VENDORS_PER_BROADCAST_ROUND,
        "broadcast_accept_window_minutes": BROADCAST_ACCEPT_WINDOW_MINUTES,
        "auto_accept_days": AUTO_ACCEPT_DAYS,
        "max_upload_size_mb": MAX_UPLOAD_SIZE_MB,
        "required_report_fields": list(REQUIRED_REPORT_FIELDS),
    }


async def update_system_config(
    db: AsyncSession, *, updates: dict, updated_by: UUID
) -> SystemConfig:
    config = await get_system_config(db)
    for key, value in updates.items():
        if value is not None and hasattr(config, key):
            setattr(config, key, value)
    config.updated_by = updated_by
    await db.flush()
    await _invalidate_cache()
    return config
```

- [ ] **Step 2: Verify imports are clean**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.system_config_service import get_system_config, update_system_config, get_config_values; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/system_config_service.py
git commit -m "feat(phase12b): add system config service with Redis cache"
```

---

### Task 4: Vendor Config Service

**Files:**
- Create: `backend/app/services/vendor_config_service.py`

- [ ] **Step 1: Create vendor config service**

Create `backend/app/services/vendor_config_service.py`:

```python
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lender import Lender
from app.models.user import Organization
from app.models.vendor_config import VendorConfig, VendorLenderExclusion


async def get_vendor_config(db: AsyncSession, vendor_id: UUID) -> VendorConfig:
    result = await db.execute(
        select(VendorConfig).where(VendorConfig.vendor_id == vendor_id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = VendorConfig(vendor_id=vendor_id)
        db.add(config)
        await db.flush()
    return config


async def update_vendor_config(
    db: AsyncSession, vendor_id: UUID, *, updates: dict
) -> VendorConfig:
    config = await get_vendor_config(db, vendor_id)
    for key, value in updates.items():
        if value is not None and hasattr(config, key):
            if key == "price_threshold" and value is not None:
                setattr(config, key, Decimal(value))
            else:
                setattr(config, key, value)
    await db.flush()
    return config


async def get_vendor_exclusions(
    db: AsyncSession, vendor_id: UUID
) -> list[dict]:
    result = await db.execute(
        select(VendorLenderExclusion, Organization.name)
        .join(Lender, Lender.id == VendorLenderExclusion.lender_id)
        .join(Organization, Organization.id == Lender.organization_id)
        .where(VendorLenderExclusion.vendor_id == vendor_id)
        .order_by(VendorLenderExclusion.created_at.desc())
    )
    return [
        {
            "lender_id": str(row.VendorLenderExclusion.lender_id),
            "lender_name": row.name,
            "created_at": row.VendorLenderExclusion.created_at.isoformat(),
        }
        for row in result.all()
    ]


async def add_vendor_exclusion(
    db: AsyncSession, vendor_id: UUID, lender_id: UUID
) -> VendorLenderExclusion:
    # Check if already exists
    result = await db.execute(
        select(VendorLenderExclusion).where(
            VendorLenderExclusion.vendor_id == vendor_id,
            VendorLenderExclusion.lender_id == lender_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError("Exclusion already exists")

    exclusion = VendorLenderExclusion(
        vendor_id=vendor_id, lender_id=lender_id
    )
    db.add(exclusion)
    await db.flush()
    return exclusion


async def remove_vendor_exclusion(
    db: AsyncSession, vendor_id: UUID, lender_id: UUID
) -> None:
    result = await db.execute(
        select(VendorLenderExclusion).where(
            VendorLenderExclusion.vendor_id == vendor_id,
            VendorLenderExclusion.lender_id == lender_id,
        )
    )
    exclusion = result.scalar_one_or_none()
    if exclusion:
        await db.delete(exclusion)
        await db.flush()


async def get_excluded_vendor_ids_for_lender(
    db: AsyncSession, lender_id: UUID
) -> list[UUID]:
    result = await db.execute(
        select(VendorLenderExclusion.vendor_id).where(
            VendorLenderExclusion.lender_id == lender_id
        )
    )
    return list(result.scalars().all())
```

- [ ] **Step 2: Verify imports**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.vendor_config_service import get_vendor_config, get_vendor_exclusions; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/vendor_config_service.py
git commit -m "feat(phase12b): add vendor config service with exclusions"
```

---

### Task 5: Lender Config Service

**Files:**
- Create: `backend/app/services/lender_config_service.py`

- [ ] **Step 1: Create lender config service**

Create `backend/app/services/lender_config_service.py`:

```python
from uuid import UUID

from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lender_config import LenderConfig, LenderVendorPreference
from app.models.request import ReportRequest, RequestAcceptance
from app.models.user import Organization
from app.models.vendor import Vendor


async def get_lender_config(db: AsyncSession, lender_id: UUID) -> LenderConfig:
    result = await db.execute(
        select(LenderConfig).where(LenderConfig.lender_id == lender_id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = LenderConfig(lender_id=lender_id)
        db.add(config)
        await db.flush()
    return config


async def get_vendor_preferences(
    db: AsyncSession, lender_id: UUID
) -> list[dict]:
    """Get all vendors this lender has worked with + their auto-approve setting."""
    # Find distinct vendors from accepted requests
    vendor_ids_stmt = (
        select(distinct(RequestAcceptance.vendor_id))
        .join(ReportRequest, ReportRequest.id == RequestAcceptance.request_id)
        .where(ReportRequest.lender_id == lender_id)
    )
    vendor_ids_result = await db.execute(vendor_ids_stmt)
    vendor_ids = list(vendor_ids_result.scalars().all())

    if not vendor_ids:
        return []

    # Get vendor names
    vendors_result = await db.execute(
        select(Vendor.id, Organization.name)
        .join(Organization, Organization.id == Vendor.organization_id)
        .where(Vendor.id.in_(vendor_ids))
        .order_by(Organization.name)
    )
    vendors = vendors_result.all()

    # Get existing preferences
    prefs_result = await db.execute(
        select(LenderVendorPreference).where(
            LenderVendorPreference.lender_id == lender_id,
            LenderVendorPreference.vendor_id.in_(vendor_ids),
        )
    )
    prefs_map = {
        p.vendor_id: p.auto_approve
        for p in prefs_result.scalars().all()
    }

    return [
        {
            "vendor_id": str(row.id),
            "vendor_name": row.name,
            "auto_approve": prefs_map.get(row.id, False),
        }
        for row in vendors
    ]


async def set_vendor_preference(
    db: AsyncSession,
    lender_id: UUID,
    vendor_id: UUID,
    auto_approve: bool,
) -> LenderVendorPreference:
    result = await db.execute(
        select(LenderVendorPreference).where(
            LenderVendorPreference.lender_id == lender_id,
            LenderVendorPreference.vendor_id == vendor_id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.auto_approve = auto_approve
    else:
        pref = LenderVendorPreference(
            lender_id=lender_id,
            vendor_id=vendor_id,
            auto_approve=auto_approve,
        )
        db.add(pref)
    await db.flush()
    return pref


async def is_auto_approve(
    db: AsyncSession, lender_id: UUID, vendor_id: UUID
) -> bool:
    result = await db.execute(
        select(LenderVendorPreference.auto_approve).where(
            LenderVendorPreference.lender_id == lender_id,
            LenderVendorPreference.vendor_id == vendor_id,
        )
    )
    value = result.scalar_one_or_none()
    return value is True
```

- [ ] **Step 2: Verify imports**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.lender_config_service import get_lender_config, is_auto_approve; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/lender_config_service.py
git commit -m "feat(phase12b): add lender config service with vendor preferences"
```

---

### Task 6: Admin System Config API

**Files:**
- Create: `backend/app/api/admin/system_config.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create admin system config router**

Create `backend/app/api/admin/system_config.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.system_config import SystemConfigResponse, SystemConfigUpdate
from app.services import system_config_service
from app.services.activity_log_service import log_activity

router = APIRouter(prefix="/api/admin/system-config", tags=["admin-system-config"])


@router.get("", response_model=SystemConfigResponse)
async def get_system_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    config = await system_config_service.get_system_config(db)
    return config


@router.put("", response_model=SystemConfigResponse)
async def update_system_config(
    body: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    updates = body.model_dump(exclude_unset=True)
    config = await system_config_service.update_system_config(
        db, updates=updates, updated_by=current_user.id
    )

    await log_activity(
        db,
        actor_id=current_user.id,
        actor_type="ADMIN",
        action="SYSTEM_CONFIG_UPDATED",
        target_type="SYSTEM_CONFIG",
        target_id=config.id,
        metadata={"updated_fields": list(updates.keys())},
    )

    return config
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add import:

```python
from app.api.admin.system_config import router as admin_system_config_router
```

Add include:

```python
app.include_router(admin_system_config_router)
```

- [ ] **Step 3: Verify endpoint**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.api.admin.system_config import router; print('Routes:', [r.path for r in router.routes])"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/admin/system_config.py backend/app/main.py
git commit -m "feat(phase12b): add admin system config API endpoints"
```

---

### Task 7: Vendor Config API

**Files:**
- Create: `backend/app/api/vendor/config.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create vendor config router**

Create `backend/app/api/vendor/config.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.vendor import Vendor, VendorUser
from app.schemas.vendor_config import (
    AddExclusionRequest,
    VendorConfigResponse,
    VendorConfigUpdate,
    VendorConfigWithExclusions,
)
from app.services import vendor_config_service

router = APIRouter(prefix="/api/vendor/settings", tags=["vendor-config"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    )
    vendor_id = result.scalar_one_or_none()
    if not vendor_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_id


@router.get("/config", response_model=VendorConfigWithExclusions)
async def get_vendor_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    config = await vendor_config_service.get_vendor_config(db, vendor_id)
    exclusions = await vendor_config_service.get_vendor_exclusions(db, vendor_id)
    return VendorConfigWithExclusions(
        config=VendorConfigResponse.model_validate(config),
        exclusions=exclusions,
    )


@router.put("/config", response_model=VendorConfigResponse)
async def update_vendor_config(
    body: VendorConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    updates = body.model_dump(exclude_unset=True)
    config = await vendor_config_service.update_vendor_config(
        db, vendor_id, updates=updates
    )
    return config


@router.post("/exclusions", status_code=201)
async def add_exclusion(
    body: AddExclusionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    try:
        await vendor_config_service.add_vendor_exclusion(
            db, vendor_id, body.lender_id
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"detail": "Exclusion added"}


@router.delete("/exclusions/{lender_id}")
async def remove_exclusion(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    await vendor_config_service.remove_vendor_exclusion(db, vendor_id, lender_id)
    return {"detail": "Exclusion removed"}


@router.get("/lenders")
async def list_lenders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("VENDOR")),
):
    """Lightweight lender list for exclusion dropdown."""
    from app.models.lender import Lender
    from app.models.user import Organization

    result = await db.execute(
        select(Lender.id, Organization.name)
        .join(Organization, Organization.id == Lender.organization_id)
        .order_by(Organization.name)
    )
    return [{"id": str(row.id), "name": row.name} for row in result.all()]
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add import:

```python
from app.api.vendor.config import router as vendor_config_router
```

Add include:

```python
app.include_router(vendor_config_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/vendor/config.py backend/app/main.py
git commit -m "feat(phase12b): add vendor config API endpoints"
```

---

### Task 8: Lender Config API

**Files:**
- Create: `backend/app/api/lender/config.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create lender config router**

Create `backend/app/api/lender/config.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.lender import LenderUser
from app.models.user import User
from app.schemas.lender_config import (
    LenderConfigResponse,
    LenderConfigWithPreferences,
    SetVendorPreferenceRequest,
)
from app.services import lender_config_service

router = APIRouter(prefix="/api/lender/settings", tags=["lender-config"])


async def _get_lender_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(LenderUser.lender_id).where(LenderUser.user_id == user_id)
    )
    lender_id = result.scalar_one_or_none()
    if not lender_id:
        raise HTTPException(status_code=404, detail="Lender not found")
    return lender_id


@router.get("/config", response_model=LenderConfigWithPreferences)
async def get_lender_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    config = await lender_config_service.get_lender_config(db, lender_id)
    preferences = await lender_config_service.get_vendor_preferences(db, lender_id)
    return LenderConfigWithPreferences(
        config=LenderConfigResponse.model_validate(config),
        vendor_preferences=preferences,
    )


@router.put("/vendors/{vendor_id}/preference")
async def set_vendor_preference(
    vendor_id: UUID,
    body: SetVendorPreferenceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    await lender_config_service.set_vendor_preference(
        db, lender_id, vendor_id, body.auto_approve
    )
    return {"detail": "Preference updated"}
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add import:

```python
from app.api.lender.config import router as lender_config_router
```

Add include:

```python
app.include_router(lender_config_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/lender/config.py backend/app/main.py
git commit -m "feat(phase12b): add lender config API endpoints"
```

---

### Task 9: Workflow Wiring — System Config in Broadcast Service

**Files:**
- Modify: `backend/app/services/broadcast_service.py`

- [ ] **Step 1: Replace constant imports with config service call**

In `backend/app/services/broadcast_service.py`, replace the import:

```python
from app.core.constants import BROADCAST_ACCEPT_WINDOW_MINUTES, VENDORS_PER_BROADCAST_ROUND
```

with:

```python
from app.services.system_config_service import get_config_values
```

- [ ] **Step 2: Update `start_broadcast` to read from config**

In the `start_broadcast` function (around line 78), replace the hardcoded constant usage. Change:

```python
    batch = vendors[:VENDORS_PER_BROADCAST_ROUND]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=BROADCAST_ACCEPT_WINDOW_MINUTES)
```

to:

```python
    config = await get_config_values()
    batch = vendors[:config["vendors_per_broadcast_round"]]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=config["broadcast_accept_window_minutes"])
```

- [ ] **Step 3: Add price threshold filtering in `get_eligible_vendors`**

In the `get_eligible_vendors` function, after the existing vendor query (after line ~60), add a price threshold filter. Add a new parameter `request_price: Decimal | None = None` to the function signature:

```python
async def get_eligible_vendors(
    db: AsyncSession,
    *,
    city: str,
    area: str | None = None,
    report_category: str,
    exclude_request_id: UUID | None = None,
    request_price: Decimal | None = None,
) -> list[Vendor]:
```

After the existing query returns `vendors`, add filtering before the return:

```python
    vendors = list(result.scalars().all())

    # Filter by vendor price threshold
    if request_price is not None:
        from app.services.vendor_config_service import get_vendor_config
        filtered = []
        for vendor in vendors:
            vc = await get_vendor_config(db, vendor.id)
            if vc.price_threshold is None or request_price >= vc.price_threshold:
                filtered.append(vendor)
        vendors = filtered

    return vendors
```

- [ ] **Step 4: Pass request price to get_eligible_vendors**

In `start_broadcast` (around line 83), update the call:

```python
    vendors = await get_eligible_vendors(
        db,
        city=request.city,
        area=request.area,
        report_category=request.report_category.value,
        exclude_request_id=request.id,
        request_price=request.price,
    )
```

Do the same for any other calls to `get_eligible_vendors` in the file (check the rotation/next-round function).

- [ ] **Step 5: Update broadcast rotation similarly**

Find the rotation function (next broadcast round). It also uses `VENDORS_PER_BROADCAST_ROUND` and `BROADCAST_ACCEPT_WINDOW_MINUTES`. Update those to use `await get_config_values()` the same way, and pass `request_price` to `get_eligible_vendors`.

- [ ] **Step 6: Verify broadcast service imports clean**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.broadcast_service import start_broadcast, get_eligible_vendors; print('OK')"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/broadcast_service.py
git commit -m "feat(phase12b): wire system config + price threshold into broadcast service"
```

---

### Task 10: Workflow Wiring — Auto-Approve + Auto-Listing in Request Service

**Files:**
- Modify: `backend/app/services/request_service.py`

- [ ] **Step 1: Add auto-approve check in `accept_report`**

In `backend/app/services/request_service.py`, the `accept_report` function (line ~165) currently runs when a lender manually accepts. We need a separate entry point that checks auto-approve when a vendor submits a report.

Add a new function after `accept_report`:

```python
async def check_auto_approve(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
) -> bool:
    """Check if lender has auto-approve enabled for this vendor. If yes, auto-accept."""
    from app.services.lender_config_service import is_auto_approve

    if not await is_auto_approve(db, request.lender_id, vendor_id):
        return False

    # Auto-accept: same logic as manual accept
    request.lender_status = LenderRequestStatus.ACCEPTED
    request.vendor_status = VendorRequestStatus.ACCEPTED
    report.listing_approved = True

    _PAYABLE_TYPE_MAP = {
        RequestType.NEW: PayableType.NEW_REQUEST,
        RequestType.UPDATE: PayableType.UPDATE,
        RequestType.NEARBY: PayableType.NEARBY,
    }
    payable_type = _PAYABLE_TYPE_MAP.get(request.request_type, PayableType.NEW_REQUEST)

    await billing_service.create_billing_entries(
        db, request=request, report=report, vendor_id=vendor_id,
        payable_type=payable_type,
    )

    await _create_or_update_listing(db, report=report)
    await db.flush()

    # Notify lender users about auto-approve
    lender_users_stmt = select(LenderUser.user_id).where(
        LenderUser.lender_id == request.lender_id
    )
    lender_user_ids = (await db.execute(lender_users_stmt)).scalars().all()
    for user_id in lender_user_ids:
        await notification_service.create_notification(
            db,
            user_id=user_id,
            event_type=NotificationEventType.REQUEST_ACCEPTED,
            title="Report auto-approved",
            message=f"Report was auto-approved based on your vendor preferences",
            reference_id=request.id,
            reference_type=NotificationReferenceType.REQUEST,
        )

    await log_activity(
        db,
        actor_id=vendor_id,
        actor_type="SYSTEM",
        action="REPORT_AUTO_APPROVED",
        target_type="REQUEST",
        target_id=request.id,
    )

    # Check auto-listing
    await _check_auto_listing(db, report=report, vendor_id=vendor_id)

    return True
```

- [ ] **Step 2: Add auto-listing helper**

Add this function in request_service.py:

```python
async def _check_auto_listing(
    db: AsyncSession,
    *,
    report: Report,
    vendor_id: UUID,
) -> None:
    """If vendor has auto-listing enabled, auto-list the accepted report."""
    if not report.request_id:
        return  # Only request-based reports are eligible

    from app.services.vendor_config_service import get_vendor_config

    config = await get_vendor_config(db, vendor_id)
    if not config.auto_listing_enabled:
        return

    # Reuse existing listing logic
    await _create_or_update_listing(db, report=report)
```

- [ ] **Step 3: Add LenderUser import at top of file**

Ensure `LenderUser` is imported at the top of `request_service.py`:

```python
from app.models.lender import LenderUser
```

- [ ] **Step 4: Wire auto-approve into the vendor submit/ready flow**

Find where reports transition to READY status (when vendor uploads). In the existing flow, after a report is uploaded and status set to a ready state, call:

```python
    # Check auto-approve after report is ready for lender review
    auto_approved = await check_auto_approve(
        db, request=request, report=report, vendor_id=vendor_id
    )
    if not auto_approved:
        # Existing notification to lender about report ready for review
        ...
```

The exact location depends on the current report upload flow. The key insertion point is where `request.lender_status` is set to `RECEIVED` — add the auto-approve check right after.

- [ ] **Step 5: Also call `_check_auto_listing` from manual accept path**

In the existing `accept_report` function, after `await _create_or_update_listing(db, report=report)` (line ~198), the listing is already created by the manual accept flow. The auto-listing check is only needed for the auto-approve path (already added in Step 1). No change needed here since `accept_report` already creates listings.

- [ ] **Step 6: Verify imports**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.request_service import check_auto_approve; print('OK')"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/request_service.py
git commit -m "feat(phase12b): wire auto-approve and auto-listing into request service"
```

---

### Task 11: Workflow Wiring �� Lender Exclusions in Listing Service

**Files:**
- Modify: `backend/app/services/listing_service.py`
- Modify: `backend/app/api/lender/listings.py`

- [ ] **Step 1: Add lender_id parameter to `get_listings`**

In `backend/app/services/listing_service.py`, modify the `get_listings` function signature (line ~249) to accept an optional `lender_id`:

```python
async def get_listings(
    db: AsyncSession,
    *,
    city: str | None = None,
    pin_code: str | None = None,
    property_type: str | None = None,
    report_category: str | None = None,
    page: int = 1,
    page_size: int = 20,
    lender_id: UUID | None = None,
) -> ListingBrowseResponse:
```

- [ ] **Step 2: Add exclusion filter to the query**

After the existing WHERE clauses in `get_listings`, before the count query, add:

```python
    # Filter out listings from vendors that have excluded this lender
    if lender_id:
        from app.services.vendor_config_service import get_excluded_vendor_ids_for_lender

        excluded_vendor_ids = await get_excluded_vendor_ids_for_lender(db, lender_id)
        if excluded_vendor_ids:
            # Exclude listings where ALL reports belong to excluded vendors
            from app.models.listing import ListingReport
            excluded_listing_ids = (
                select(ListingReport.listing_id)
                .join(Report, Report.id == ListingReport.report_id)
                .where(Report.vendor_id.in_(excluded_vendor_ids))
                .group_by(ListingReport.listing_id)
            )
            stmt = stmt.where(Listing.id.notin_(excluded_listing_ids))
```

- [ ] **Step 3: Pass lender_id from the API endpoint**

In `backend/app/api/lender/listings.py`, the browse endpoint (line ~33) currently calls `listing_service.get_listings(...)`. Add lender_id resolution and pass it:

Add at the top of the browse function:

```python
    from app.models.lender import LenderUser
    lender_result = await db.execute(
        select(LenderUser.lender_id).where(LenderUser.user_id == current_user.id)
    )
    lender_id = lender_result.scalar_one_or_none()
```

Then update the call:

```python
    return await listing_service.get_listings(
        db,
        city=city,
        pin_code=pin_code,
        property_type=property_type,
        report_category=report_category,
        page=page,
        page_size=page_size,
        lender_id=lender_id,
    )
```

- [ ] **Step 4: Verify imports**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.listing_service import get_listings; print('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/listing_service.py backend/app/api/lender/listings.py
git commit -m "feat(phase12b): wire lender exclusion filter into listings browse"
```

---

### Task 12: Workflow Wiring — Upload Size from Config

**Files:**
- Modify: `backend/app/services/report_service.py`

- [ ] **Step 1: Update `validate_upload` to read from config**

In `backend/app/services/report_service.py`, the `validate_upload` function (line ~25) currently imports `MAX_UPLOAD_SIZE_MB` from constants. Change it to accept the value as a parameter:

```python
def validate_upload(content_type: str, size: int, max_upload_size_mb: int = MAX_UPLOAD_SIZE_MB) -> None:
    """Validate file type and size."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidFileError(f"File type '{content_type}' not allowed. Only PDF accepted.")
    max_bytes = max_upload_size_mb * 1024 * 1024
    if size > max_bytes:
        raise InvalidFileError(f"File too large. Maximum {max_upload_size_mb}MB allowed.")
```

- [ ] **Step 2: Update the upload endpoint to pass config value**

In `backend/app/api/vendor/reports.py`, where `validate_upload` is called (line ~65), fetch config and pass the value:

```python
    from app.services.system_config_service import get_config_values

    config = await get_config_values()
    validate_upload(file.content_type, file.size, max_upload_size_mb=config["max_upload_size_mb"])
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/report_service.py backend/app/api/vendor/reports.py
git commit -m "feat(phase12b): wire upload size limit from system config"
```

---

### Task 13: Frontend TypeScript Types

**Files:**
- Create: `frontend/src/types/config.ts`

- [ ] **Step 1: Create config types**

Create `frontend/src/types/config.ts`:

```typescript
export interface SystemConfigResponse {
  id: string;
  vendors_per_broadcast_round: number;
  broadcast_accept_window_minutes: number;
  auto_accept_days: number;
  max_upload_size_mb: number;
  required_report_fields: string[] | null;
  updated_by: string | null;
  updated_at: string;
}

export interface SystemConfigUpdate {
  vendors_per_broadcast_round?: number;
  broadcast_accept_window_minutes?: number;
  auto_accept_days?: number;
  max_upload_size_mb?: number;
  required_report_fields?: string[];
}

export interface VendorConfigResponse {
  id: string;
  vendor_id: string;
  auto_listing_enabled: boolean;
  price_threshold: string | null;
  separate_valuation_legal: boolean;
}

export interface ExclusionEntry {
  lender_id: string;
  lender_name: string;
  created_at: string;
}

export interface VendorConfigWithExclusions {
  config: VendorConfigResponse;
  exclusions: ExclusionEntry[];
}

export interface VendorPreferenceEntry {
  vendor_id: string;
  vendor_name: string;
  auto_approve: boolean;
}

export interface LenderConfigResponse {
  id: string;
  lender_id: string;
}

export interface LenderConfigWithPreferences {
  config: LenderConfigResponse;
  vendor_preferences: VendorPreferenceEntry[];
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/config.ts
git commit -m "feat(phase12b): add config TypeScript types"
```

---

### Task 14: Admin System Config Page

**Files:**
- Create: `frontend/src/app/admin/settings/page.tsx`
- Create: `frontend/src/app/admin/settings/_components/system-config-form.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Add Settings nav link to admin layout**

In `frontend/src/app/admin/layout.tsx`, add to the desktop nav links array (after Billing):

```tsx
{ href: "/admin/settings", label: "Settings" },
```

Add the same to the mobile nav links array.

- [ ] **Step 2: Create the system config form component**

Create `frontend/src/app/admin/settings/_components/system-config-form.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { SystemConfigResponse } from "@/types/config";

const KNOWN_FIELDS = [
  "property_address",
  "property_type",
  "valuation_amount",
  "plot_extent_sqft",
  "built_up_sqft",
  "loan_applicant_name",
  "report_date",
  "city",
  "pin_code",
  "latitude",
  "longitude",
  "report_category",
  "expiry_date",
];

export default function SystemConfigForm() {
  const [config, setConfig] = useState<SystemConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendorsPerRound, setVendorsPerRound] = useState(5);
  const [acceptWindow, setAcceptWindow] = useState(30);
  const [autoAcceptDays, setAutoAcceptDays] = useState(7);
  const [maxUploadMb, setMaxUploadMb] = useState(20);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.get<SystemConfigResponse>("/api/admin/system-config");
      setConfig(data);
      setVendorsPerRound(data.vendors_per_broadcast_round);
      setAcceptWindow(data.broadcast_accept_window_minutes);
      setAutoAcceptDays(data.auto_accept_days);
      setMaxUploadMb(data.max_upload_size_mb);
      setRequiredFields(data.required_report_fields || []);
    } catch {
      toast.error("Failed to load system config");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await api.put<SystemConfigResponse>("/api/admin/system-config", {
        vendors_per_broadcast_round: vendorsPerRound,
        broadcast_accept_window_minutes: acceptWindow,
        auto_accept_days: autoAcceptDays,
        max_upload_size_mb: maxUploadMb,
        required_report_fields: requiredFields,
      });
      setConfig(data);
      toast.success("System config updated");
    } catch {
      toast.error("Failed to update system config");
    } finally {
      setSaving(false);
    }
  }

  function toggleField(field: string) {
    setRequiredFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Broadcast Settings</CardTitle>
          <CardDescription>Controls how requests are broadcast to vendors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="vendors-per-round">Vendors per broadcast round</Label>
            <Input
              id="vendors-per-round"
              type="number"
              min={1}
              max={50}
              value={vendorsPerRound}
              onChange={(e) => setVendorsPerRound(Number(e.target.value))}
              className="mt-1 w-32"
            />
          </div>
          <div>
            <Label htmlFor="accept-window">Accept window (minutes)</Label>
            <Input
              id="accept-window"
              type="number"
              min={5}
              max={1440}
              value={acceptWindow}
              onChange={(e) => setAcceptWindow(Number(e.target.value))}
              className="mt-1 w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acceptance Settings</CardTitle>
          <CardDescription>Auto-accept rules for pending requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="auto-accept-days">Auto-accept after (days)</Label>
            <Input
              id="auto-accept-days"
              type="number"
              min={1}
              max={90}
              value={autoAcceptDays}
              onChange={(e) => setAutoAcceptDays(Number(e.target.value))}
              className="mt-1 w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Settings</CardTitle>
          <CardDescription>File upload constraints</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="max-upload">Max upload size (MB)</Label>
            <Input
              id="max-upload"
              type="number"
              min={1}
              max={200}
              value={maxUploadMb}
              onChange={(e) => setMaxUploadMb(Number(e.target.value))}
              className="mt-1 w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation Settings</CardTitle>
          <CardDescription>Required fields before a report can be published</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {KNOWN_FIELDS.map((field) => (
              <div key={field} className="flex items-center space-x-2">
                <Checkbox
                  id={`field-${field}`}
                  checked={requiredFields.includes(field)}
                  onCheckedChange={() => toggleField(field)}
                />
                <Label htmlFor={`field-${field}`} className="text-sm font-normal">
                  {field.replace(/_/g, " ")}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {config?.updated_at && (
        <p className="text-sm text-muted-foreground text-right">
          Last updated: {new Date(config.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the admin settings page**

Create `frontend/src/app/admin/settings/page.tsx`:

```tsx
import SystemConfigForm from "./_components/system-config-form";

export default function AdminSettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">System Settings</h1>
      <SystemConfigForm />
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/settings/ frontend/src/app/admin/layout.tsx
git commit -m "feat(phase12b): add admin system config page"
```

---

### Task 15: Vendor Settings — Configuration Tab

**Files:**
- Modify: `frontend/src/app/vendor/settings/page.tsx`

- [ ] **Step 1: Read the current vendor settings page**

Read `frontend/src/app/vendor/settings/page.tsx` to get the exact current code structure.

- [ ] **Step 2: Add Configuration tab**

Add a "configuration" tab to the existing tabs array. Add the Configuration tab content with:

- **Auto-listing toggle** (Switch component)
- **Price threshold** (Input, type number, optional)
- **Separate valuation/legal toggle** (Switch component)
- **Lender exclusions table** with add/remove

The tab content should be a new inline section or a `_components/vendor-config-tab.tsx` component. Use the same patterns as the existing Users and Notifications tabs.

Create `frontend/src/app/vendor/settings/_components/vendor-config-tab.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { VendorConfigWithExclusions, ExclusionEntry } from "@/types/config";

interface LenderOption {
  id: string;
  name: string;
}

export default function VendorConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoListing, setAutoListing] = useState(false);
  const [priceThreshold, setPriceThreshold] = useState("");
  const [separateValLegal, setSeparateValLegal] = useState(false);
  const [exclusions, setExclusions] = useState<ExclusionEntry[]>([]);
  const [lenders, setLenders] = useState<LenderOption[]>([]);
  const [selectedLenderId, setSelectedLenderId] = useState("");

  useEffect(() => {
    loadConfig();
    loadLenders();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.get<VendorConfigWithExclusions>("/api/vendor/settings/config");
      setAutoListing(data.config.auto_listing_enabled);
      setPriceThreshold(data.config.price_threshold || "");
      setSeparateValLegal(data.config.separate_valuation_legal);
      setExclusions(data.exclusions);
    } catch {
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }

  async function loadLenders() {
    try {
      const data = await api.get<{ id: string; name: string }[]>("/api/vendor/settings/lenders");
      setLenders(data);
    } catch {
      // Lender list unavailable
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/api/vendor/settings/config", {
        auto_listing_enabled: autoListing,
        price_threshold: priceThreshold || null,
        separate_valuation_legal: separateValLegal,
      });
      toast.success("Configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddExclusion() {
    if (!selectedLenderId) return;
    try {
      await api.post("/api/vendor/settings/exclusions", { lender_id: selectedLenderId });
      toast.success("Lender excluded");
      setSelectedLenderId("");
      loadConfig();
    } catch {
      toast.error("Failed to add exclusion");
    }
  }

  async function handleRemoveExclusion(lenderId: string) {
    try {
      await api.delete(`/api/vendor/settings/exclusions/${lenderId}`);
      toast.success("Exclusion removed");
      loadConfig();
    } catch {
      toast.error("Failed to remove exclusion");
    }
  }

  if (loading) return <div className="py-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Listing Preferences</CardTitle>
          <CardDescription>Control how your reports appear on the marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-list accepted reports</Label>
              <p className="text-sm text-muted-foreground">
                Automatically list reports on the marketplace when accepted
              </p>
            </div>
            <Switch checked={autoListing} onCheckedChange={setAutoListing} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Set minimum price preferences for broadcast requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="price-threshold">Minimum price threshold</Label>
            <Input
              id="price-threshold"
              type="number"
              min={0}
              step="0.01"
              placeholder="Leave blank to accept all"
              value={priceThreshold}
              onChange={(e) => setPriceThreshold(e.target.value)}
              className="mt-1 w-48"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Types</CardTitle>
          <CardDescription>Configure how your services are categorized</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Separate valuation & legal settings</Label>
              <p className="text-sm text-muted-foreground">
                Enable separate configuration for valuation and legal report types
              </p>
            </div>
            <Switch checked={separateValLegal} onCheckedChange={setSeparateValLegal} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lender Exclusions</CardTitle>
          <CardDescription>
            Excluded lenders cannot see your listings on the marketplace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <select
              value={selectedLenderId}
              onChange={(e) => setSelectedLenderId(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm flex-1"
            >
              <option value="">Select a lender to exclude...</option>
              {lenders
                .filter((l) => !exclusions.some((e) => e.lender_id === l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
            <Button onClick={handleAddExclusion} disabled={!selectedLenderId} variant="outline">
              Add
            </Button>
          </div>

          {exclusions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lenders excluded</p>
          ) : (
            <div className="space-y-2">
              {exclusions.map((exc) => (
                <div
                  key={exc.lender_id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{exc.lender_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(exc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveExclusion(exc.lender_id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the tab to vendor settings page**

In `frontend/src/app/vendor/settings/page.tsx`, import and add the Configuration tab:

Add import:

```tsx
import VendorConfigTab from "./_components/vendor-config-tab";
```

Add to tabs array:

```tsx
{ key: "configuration", label: "Configuration" },
```

Add to the tab content rendering:

```tsx
{activeTab === "configuration" && <VendorConfigTab />}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/vendor/settings/
git commit -m "feat(phase12b): add vendor configuration tab with exclusions"
```

---

### Task 16: Lender Settings — Configuration Tab

**Files:**
- Modify: `frontend/src/app/lender/settings/page.tsx`

- [ ] **Step 1: Read the current lender settings page**

Read `frontend/src/app/lender/settings/page.tsx` for the current tab structure.

- [ ] **Step 2: Create lender config tab component**

Create `frontend/src/app/lender/settings/_components/lender-config-tab.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { LenderConfigWithPreferences, VendorPreferenceEntry } from "@/types/config";

export default function LenderConfigTab() {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<VendorPreferenceEntry[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.get<LenderConfigWithPreferences>("/api/lender/settings/config");
      setPreferences(data.vendor_preferences);
    } catch {
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(vendorId: string, autoApprove: boolean) {
    try {
      await api.put(`/api/lender/settings/vendors/${vendorId}/preference`, {
        auto_approve: autoApprove,
      });
      setPreferences((prev) =>
        prev.map((p) =>
          p.vendor_id === vendorId ? { ...p, auto_approve: autoApprove } : p
        )
      );
      toast.success(autoApprove ? "Auto-approve enabled" : "Auto-approve disabled");
    } catch {
      toast.error("Failed to update preference");
    }
  }

  const filtered = preferences.filter((p) =>
    p.vendor_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="py-4">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Auto-Approve</CardTitle>
        <CardDescription>
          Automatically accept reports from trusted vendors. Only vendors you have
          worked with are shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {preferences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vendor history yet. Vendors will appear here after completing requests.
          </p>
        ) : (
          <>
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="space-y-2">
              {filtered.map((pref) => (
                <div
                  key={pref.vendor_id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <p className="font-medium text-sm">{pref.vendor_name}</p>
                  <Switch
                    checked={pref.auto_approve}
                    onCheckedChange={(checked) =>
                      handleToggle(pref.vendor_id, checked)
                    }
                  />
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No vendors match your search</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Add the tab to lender settings page**

In `frontend/src/app/lender/settings/page.tsx`, import and add:

Add import:

```tsx
import LenderConfigTab from "./_components/lender-config-tab";
```

Add to tabs array:

```tsx
{ key: "configuration", label: "Configuration" },
```

Add to tab content rendering:

```tsx
{activeTab === "configuration" && <LenderConfigTab />}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lender/settings/
git commit -m "feat(phase12b): add lender configuration tab with vendor auto-approve"
```

---

### Task 17: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Phase 12B status in CLAUDE.md**

Add Phase 12B completion status in the Current Status section after Phase 12A:

```
**Phase 12B (System & Entity Config):** Complete — SystemConfig model with Redis cache (60s TTL) for broadcast/acceptance/upload params, VendorConfig model with auto-listing toggle and price threshold, LenderConfig with per-vendor auto-approve preferences, VendorLenderExclusion for listings visibility filtering, admin system config page, vendor/lender configuration tabs, workflow wiring (auto-approve in request service, auto-listing on acceptance, price threshold in broadcast, exclusion filter in listings browse, upload size from config)
```

- [ ] **Step 2: Add new key files**

Add to Key Files section:

```
- `backend/app/models/system_config.py` — SystemConfig model (global platform params)
- `backend/app/models/vendor_config.py` — VendorConfig + VendorLenderExclusion models
- `backend/app/models/lender_config.py` — LenderConfig + LenderVendorPreference models
- `backend/app/services/system_config_service.py` — System config CRUD + Redis cache
- `backend/app/services/vendor_config_service.py` — Vendor config + exclusion CRUD
- `backend/app/services/lender_config_service.py` — Lender config + vendor preferences
- `backend/app/api/admin/system_config.py` — Admin system config endpoints
- `frontend/src/app/admin/settings/page.tsx` — Admin system config page
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(phase12b): update CLAUDE.md with Phase 12B completion status"
```
