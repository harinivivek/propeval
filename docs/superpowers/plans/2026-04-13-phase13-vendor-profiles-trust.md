# Phase 13: Vendor Profiles & Trust Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer, services, APIs, and UI for vendor public profiles, star ratings, quality scores, and the three-tier trust system (New → Verified → Top Valuer).

**Architecture:** Extends the existing Vendor model with a 1:1 VendorProfile (profile data, quality score, tier) and a 1:N VendorRating (lender star ratings per request). Quality score is a composite metric (0-100) recalculated on each new data point. Tier stored on VendorProfile with automated promotion checks on report acceptance and rating submission.

**Tech Stack:** SQLAlchemy 2.0 models, Alembic migration, Pydantic v2 schemas, FastAPI routers, async services, React 19 + TypeScript + Tailwind + shadcn/ui frontend components.

**Spec:** `docs/superpowers/specs/2026-04-13-airbnb-style-marketplace-enhancement-design.md` (Section 4)

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/vendor_profile.py` | VendorProfile + VendorRating SQLAlchemy models |
| `backend/app/schemas/vendor_profile.py` | Pydantic schemas for profile CRUD, rating, tier progress |
| `backend/app/services/vendor_profile_service.py` | Profile CRUD, quality score calculation, tier check |
| `backend/app/services/vendor_rating_service.py` | Rating CRUD, aggregation queries |
| `backend/app/api/vendor/profile.py` | Vendor-side profile endpoints (view/edit own profile, tier status) |
| `backend/app/api/lender/vendors.py` | Lender-side vendor endpoints (public profile, portfolio, submit rating) |
| `backend/app/api/admin/vendor_tiers.py` | Admin tier override endpoint |
| `backend/tests/services/test_vendor_profile_service.py` | Service tests for profile + quality score |
| `backend/tests/services/test_vendor_rating_service.py` | Service tests for rating |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/enums.py` | Add `VendorTier` enum, add `VENDOR_RATED` to NotificationEventType, add `VENDOR_RATING` to ActivityAction |
| `backend/app/models/__init__.py` | Register VendorProfile, VendorRating, VendorTier |
| `backend/app/main.py` | Register vendor profile + lender vendors + admin vendor tiers routers |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/types/vendor-profile.ts` | TypeScript interfaces for profile, rating, tier |
| `frontend/src/app/vendor/profile/page.tsx` | Vendor profile editor page |
| `frontend/src/app/vendor/profile/_components/profile-form.tsx` | Profile edit form component |
| `frontend/src/app/vendor/profile/_components/profile-photo-upload.tsx` | Photo upload with preview |
| `frontend/src/app/vendor/dashboard/_components/tier-card.tsx` | Tier status + progress card |
| `frontend/src/app/vendor/dashboard/_components/quality-score-card.tsx` | Quality score breakdown card |
| `frontend/src/app/lender/vendors/[id]/page.tsx` | Public vendor profile page |
| `frontend/src/app/lender/vendors/[id]/_components/vendor-portfolio.tsx` | Portfolio listing component |
| `frontend/src/app/lender/vendors/[id]/_components/vendor-stats-bar.tsx` | Performance metrics bar |
| `frontend/src/components/tier-badge.tsx` | Reusable tier badge component |
| `frontend/src/components/rating-stars.tsx` | Reusable star rating display + input |
| `frontend/src/components/rating-modal.tsx` | Post-acceptance rating dialog |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/app/vendor/dashboard/page.tsx` | Add TierCard and QualityScoreCard |
| `frontend/src/app/lender/requests/[id]/page.tsx` (or its detail component) | Add rating prompt after acceptance |

---

## Task 1: Add Enums

**Files:**
- Modify: `backend/app/models/enums.py`

- [ ] **Step 1: Write failing test for VendorTier enum**

Create test file:

```python
# backend/tests/services/test_vendor_profile_service.py
import pytest
from app.models.enums import VendorTier


def test_vendor_tier_values():
    assert VendorTier.NEW.value == "NEW"
    assert VendorTier.VERIFIED.value == "VERIFIED"
    assert VendorTier.TOP_VALUER.value == "TOP_VALUER"
    assert len(VendorTier) == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_vendor_profile_service.py::test_vendor_tier_values -v`
Expected: FAIL with `ImportError: cannot import name 'VendorTier'`

- [ ] **Step 3: Add VendorTier enum to enums.py**

Add to `backend/app/models/enums.py` after the `ActivityTargetType` class:

```python
class VendorTier(str, Enum):
    NEW = "NEW"
    VERIFIED = "VERIFIED"
    TOP_VALUER = "TOP_VALUER"
```

- [ ] **Step 4: Add notification and activity enums**

Add `VENDOR_RATED` to `NotificationEventType` in `backend/app/models/enums.py`:

```python
class NotificationEventType(str, Enum):
    NEW_BROADCAST = "NEW_BROADCAST"
    REQUEST_ACCEPTED = "REQUEST_ACCEPTED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    LISTING_DOWNLOADED = "LISTING_DOWNLOADED"
    INVOICE_GENERATED = "INVOICE_GENERATED"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    VENDOR_RATED = "VENDOR_RATED"
```

Add `VENDOR_RATED` and `VENDOR_TIER_CHANGED` to `ActivityAction`:

```python
class ActivityAction(str, Enum):
    # ... existing values ...
    REPORT_AUTO_APPROVED = "REPORT_AUTO_APPROVED"
    VENDOR_RATED = "VENDOR_RATED"
    VENDOR_TIER_CHANGED = "VENDOR_TIER_CHANGED"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/test_vendor_profile_service.py::test_vendor_tier_values -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/enums.py backend/tests/services/test_vendor_profile_service.py
git commit -m "feat(phase13): add VendorTier enum and rating notification/activity types"
```

---

## Task 2: Create VendorProfile and VendorRating Models

**Files:**
- Create: `backend/app/models/vendor_profile.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the VendorProfile model**

```python
# backend/app/models/vendor_profile.py
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import VendorTier


class VendorProfile(BaseModel):
    __tablename__ = "vendor_profiles"
    __table_args__ = (
        UniqueConstraint("vendor_id", name="uq_vendor_profile_vendor"),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    display_photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    founding_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    certifications: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    specialization_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    quality_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00")
    )
    vendor_tier: Mapped[VendorTier] = mapped_column(
        SQLEnum(VendorTier), default=VendorTier.NEW
    )
    tier_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    tier_warning_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    profile_completeness: Mapped[int] = mapped_column(Integer, default=0)


class VendorRating(BaseModel):
    __tablename__ = "vendor_ratings"
    __table_args__ = (
        UniqueConstraint(
            "report_request_id", name="uq_vendor_rating_request"
        ),
    )

    lender_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    report_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("report_requests.id"), index=True
    )
    rating: Mapped[int] = mapped_column(Integer)
```

- [ ] **Step 2: Register models in `__init__.py`**

Add to `backend/app/models/__init__.py`:

Import line (after vendor_config imports):
```python
from app.models.vendor_profile import VendorProfile, VendorRating
```

Add to `__all__` list (after `LenderVendorPreference`):
```python
    # Phase 13 — Vendor Profiles & Trust
    "VendorTier",
    "VendorProfile",
    "VendorRating",
```

Also add `VendorTier` to the enums import block at the top:
```python
from app.models.enums import (
    # ... existing ...
    VendorTier,
)
```

- [ ] **Step 3: Verify models import correctly**

Run: `cd backend && python -c "from app.models import VendorProfile, VendorRating, VendorTier; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/vendor_profile.py backend/app/models/__init__.py
git commit -m "feat(phase13): add VendorProfile and VendorRating models"
```

---

## Task 3: Generate Alembic Migration

**Files:**
- Create: `backend/alembic/versions/<auto>_add_vendor_profile_and_rating.py`

- [ ] **Step 1: Generate the migration inside Docker**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic revision --autogenerate -m "add vendor profile and rating tables"
```

- [ ] **Step 2: Copy migration from container to host**

```bash
# Find the generated migration file
docker compose -f docker-compose.local.yml --env-file .env.local exec backend ls -t alembic/versions/ | head -3

# Copy it (replace <filename> with actual):
docker cp propeval-backend-1:/app/alembic/versions/<filename>.py backend/alembic/versions/
```

- [ ] **Step 3: Run the migration**

```bash
make migrate
```

Expected: Migration applies without errors.

- [ ] **Step 4: Verify tables exist**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec db psql -U propeval -d propeval -c "\dt vendor_profiles; \dt vendor_ratings"
```

Expected: Both tables listed.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat(phase13): add migration for vendor_profiles and vendor_ratings tables"
```

---

## Task 4: Create Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/vendor_profile.py`

- [ ] **Step 1: Create the schema file**

```python
# backend/app/schemas/vendor_profile.py
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CertificationEntry(BaseModel):
    name: str
    registration_number: str | None = None
    issued_by: str | None = None
    year: int | None = None


class VendorProfileResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    display_photo: str | None = None
    bio: str | None = None
    founding_year: int | None = None
    certifications: list[CertificationEntry] | None = None
    specialization_tags: list[str] | None = None
    quality_score: str  # Decimal serialized as string
    vendor_tier: str
    tier_changed_at: datetime | None = None
    profile_completeness: int


class VendorProfileUpdate(BaseModel):
    bio: str | None = None
    founding_year: int | None = None
    certifications: list[CertificationEntry] | None = None
    specialization_tags: list[str] | None = None


class VendorPublicProfile(BaseModel):
    """Public-facing profile seen by lenders."""
    vendor_id: UUID
    vendor_name: str
    display_photo: str | None = None
    bio: str | None = None
    founding_year: int | None = None
    certifications: list[CertificationEntry] | None = None
    specialization_tags: list[str] | None = None
    quality_score: str
    vendor_tier: str
    total_completed_jobs: int
    avg_rating: float | None = None
    rating_count: int
    first_time_acceptance_rate: float | None = None
    avg_turnaround_hours: float | None = None
    on_time_delivery_rate: float | None = None
    service_areas: list[dict]


class PortfolioEntry(BaseModel):
    report_category: str
    property_type: str
    city: str
    area: str | None = None
    completed_at: datetime


class PortfolioResponse(BaseModel):
    entries: list[PortfolioEntry]
    total: int
    page: int
    page_size: int


class VendorRatingCreate(BaseModel):
    rating: int = Field(ge=1, le=5)


class VendorRatingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_user_id: UUID
    vendor_id: UUID
    report_request_id: UUID
    rating: int
    created_at: datetime


class RatingSummary(BaseModel):
    avg_rating: float | None = None
    rating_count: int
    distribution: dict[str, int]  # {"1": 2, "2": 0, "3": 5, ...}


class QualityScoreBreakdown(BaseModel):
    overall: str  # Decimal as string
    lender_rating_avg: float | None = None
    lender_rating_weight: int = 30
    first_time_acceptance_rate: float | None = None
    first_time_acceptance_weight: int = 25
    on_time_delivery_rate: float | None = None
    on_time_delivery_weight: int = 20
    revision_rate: float | None = None
    revision_rate_weight: int = 15
    ocr_completeness: float | None = None
    ocr_completeness_weight: int = 10


class TierProgressResponse(BaseModel):
    current_tier: str
    tier_since: datetime | None = None
    completed_jobs: int
    quality_score: str
    avg_response_time_hours: float | None = None
    next_tier: str | None = None
    next_tier_requirements: dict | None = None
    quality_breakdown: QualityScoreBreakdown
```

- [ ] **Step 2: Verify schemas import**

Run: `cd backend && python -c "from app.schemas.vendor_profile import VendorProfileResponse, VendorRatingCreate, TierProgressResponse; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/vendor_profile.py
git commit -m "feat(phase13): add Pydantic schemas for vendor profile, rating, and tier"
```

---

## Task 5: Create Vendor Rating Service

**Files:**
- Create: `backend/app/services/vendor_rating_service.py`
- Create: `backend/tests/services/test_vendor_rating_service.py`

- [ ] **Step 1: Write failing tests for rating service**

```python
# backend/tests/services/test_vendor_rating_service.py
import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    UserType,
)
from app.models.lender import Lender
from app.models.request import ReportRequest
from app.models.user import Organization, User
from app.models.vendor import Vendor
from app.models.vendor_profile import VendorRating
from app.services import vendor_rating_service


async def _setup_rating_data(db: AsyncSession):
    """Create lender user, vendor, and accepted request for rating tests."""
    # Lender
    lender_org = Organization(name="Test Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Test Bank", city="Mumbai")
    db.add(lender)
    lender_user = User(
        email="lender@test.com",
        mobile="9000000001",
        full_name="Lender User",
        hashed_password="fake",
        user_type=UserType.LENDER,
        organization_id=lender_org.id,
    )
    db.add(lender_user)

    # Vendor
    vendor_org = Organization(name="Test Vendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="Test Vendor")
    db.add(vendor)
    await db.flush()

    # Accepted request
    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.ACCEPTED,
    )
    db.add(request)
    await db.flush()

    return lender_user, vendor, request


@pytest.mark.asyncio
async def test_submit_rating(db_session: AsyncSession):
    lender_user, vendor, request = await _setup_rating_data(db_session)

    rating = await vendor_rating_service.submit_rating(
        db_session,
        lender_user_id=lender_user.id,
        vendor_id=vendor.id,
        report_request_id=request.id,
        rating=4,
    )

    assert rating.rating == 4
    assert rating.vendor_id == vendor.id
    assert rating.lender_user_id == lender_user.id


@pytest.mark.asyncio
async def test_submit_rating_upsert(db_session: AsyncSession):
    lender_user, vendor, request = await _setup_rating_data(db_session)

    await vendor_rating_service.submit_rating(
        db_session,
        lender_user_id=lender_user.id,
        vendor_id=vendor.id,
        report_request_id=request.id,
        rating=3,
    )

    # Update the same rating
    rating = await vendor_rating_service.submit_rating(
        db_session,
        lender_user_id=lender_user.id,
        vendor_id=vendor.id,
        report_request_id=request.id,
        rating=5,
    )

    assert rating.rating == 5


@pytest.mark.asyncio
async def test_get_vendor_avg_rating(db_session: AsyncSession):
    lender_user, vendor, request = await _setup_rating_data(db_session)

    await vendor_rating_service.submit_rating(
        db_session,
        lender_user_id=lender_user.id,
        vendor_id=vendor.id,
        report_request_id=request.id,
        rating=4,
    )

    avg, count = await vendor_rating_service.get_vendor_avg_rating(
        db_session, vendor.id
    )
    assert avg == 4.0
    assert count == 1


@pytest.mark.asyncio
async def test_get_rating_distribution(db_session: AsyncSession):
    lender_user, vendor, request = await _setup_rating_data(db_session)

    await vendor_rating_service.submit_rating(
        db_session,
        lender_user_id=lender_user.id,
        vendor_id=vendor.id,
        report_request_id=request.id,
        rating=4,
    )

    dist = await vendor_rating_service.get_rating_distribution(
        db_session, vendor.id
    )
    assert dist == {"1": 0, "2": 0, "3": 0, "4": 1, "5": 0}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_vendor_rating_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.vendor_rating_service'`

- [ ] **Step 3: Implement vendor_rating_service.py**

```python
# backend/app/services/vendor_rating_service.py
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_profile import VendorRating


async def submit_rating(
    db: AsyncSession,
    *,
    lender_user_id: UUID,
    vendor_id: UUID,
    report_request_id: UUID,
    rating: int,
) -> VendorRating:
    """Submit or update a rating for a vendor on a specific request."""
    result = await db.execute(
        select(VendorRating).where(
            VendorRating.report_request_id == report_request_id
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.rating = rating
        await db.flush()
        return existing

    vendor_rating = VendorRating(
        lender_user_id=lender_user_id,
        vendor_id=vendor_id,
        report_request_id=report_request_id,
        rating=rating,
    )
    db.add(vendor_rating)
    await db.flush()
    return vendor_rating


async def get_vendor_avg_rating(
    db: AsyncSession, vendor_id: UUID
) -> tuple[float | None, int]:
    """Return (average_rating, count) for a vendor."""
    result = await db.execute(
        select(
            func.avg(VendorRating.rating).label("avg"),
            func.count(VendorRating.id).label("cnt"),
        ).where(VendorRating.vendor_id == vendor_id)
    )
    row = result.one()
    avg = round(float(row.avg), 2) if row.avg is not None else None
    return avg, row.cnt


async def get_rating_distribution(
    db: AsyncSession, vendor_id: UUID
) -> dict[str, int]:
    """Return rating distribution {\"1\": n, \"2\": n, ...}."""
    result = await db.execute(
        select(
            VendorRating.rating,
            func.count(VendorRating.id).label("cnt"),
        )
        .where(VendorRating.vendor_id == vendor_id)
        .group_by(VendorRating.rating)
    )
    dist = {str(i): 0 for i in range(1, 6)}
    for row in result.all():
        dist[str(row.rating)] = row.cnt
    return dist


async def get_vendor_ratings(
    db: AsyncSession, vendor_id: UUID, *, page: int = 1, page_size: int = 20
) -> tuple[list[VendorRating], int]:
    """Return paginated ratings for a vendor."""
    count_result = await db.execute(
        select(func.count(VendorRating.id)).where(
            VendorRating.vendor_id == vendor_id
        )
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(VendorRating)
        .where(VendorRating.vendor_id == vendor_id)
        .order_by(VendorRating.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), total
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_vendor_rating_service.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/vendor_rating_service.py backend/tests/services/test_vendor_rating_service.py
git commit -m "feat(phase13): add vendor rating service with submit, avg, distribution"
```

---

## Task 6: Create Vendor Profile Service

**Files:**
- Create: `backend/app/services/vendor_profile_service.py`
- Modify: `backend/tests/services/test_vendor_profile_service.py`

- [ ] **Step 1: Add failing tests for profile service**

Append to `backend/tests/services/test_vendor_profile_service.py`:

```python
import uuid
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserType, VendorTier
from app.models.user import Organization
from app.models.vendor import Vendor
from app.models.vendor_profile import VendorProfile
from app.services import vendor_profile_service


async def _create_vendor(db: AsyncSession, name: str = "Test Vendor") -> Vendor:
    org = Organization(name=name, type=UserType.VENDOR, city="Mumbai")
    db.add(org)
    await db.flush()
    vendor = Vendor(organization_id=org.id, name=name)
    db.add(vendor)
    await db.flush()
    return vendor


@pytest.mark.asyncio
async def test_get_or_create_profile(db_session: AsyncSession):
    vendor = await _create_vendor(db_session)
    profile = await vendor_profile_service.get_or_create_profile(db_session, vendor.id)

    assert profile.vendor_id == vendor.id
    assert profile.vendor_tier == VendorTier.NEW
    assert profile.quality_score == Decimal("0.00")
    assert profile.profile_completeness == 0


@pytest.mark.asyncio
async def test_get_or_create_profile_idempotent(db_session: AsyncSession):
    vendor = await _create_vendor(db_session)

    p1 = await vendor_profile_service.get_or_create_profile(db_session, vendor.id)
    p2 = await vendor_profile_service.get_or_create_profile(db_session, vendor.id)
    assert p1.id == p2.id


@pytest.mark.asyncio
async def test_update_profile(db_session: AsyncSession):
    vendor = await _create_vendor(db_session)
    await vendor_profile_service.get_or_create_profile(db_session, vendor.id)

    updated = await vendor_profile_service.update_profile(
        db_session,
        vendor.id,
        updates={
            "bio": "Expert valuer in Mumbai",
            "founding_year": 2015,
            "specialization_tags": ["Residential", "Commercial"],
        },
    )
    assert updated.bio == "Expert valuer in Mumbai"
    assert updated.founding_year == 2015
    assert updated.specialization_tags == ["Residential", "Commercial"]


@pytest.mark.asyncio
async def test_profile_completeness(db_session: AsyncSession):
    vendor = await _create_vendor(db_session)
    profile = await vendor_profile_service.get_or_create_profile(db_session, vendor.id)
    assert profile.profile_completeness == 0

    await vendor_profile_service.update_profile(
        db_session,
        vendor.id,
        updates={
            "bio": "Expert valuer",
            "founding_year": 2015,
            "certifications": [{"name": "IBBI", "registration_number": "123"}],
            "specialization_tags": ["Residential"],
        },
    )
    profile = await vendor_profile_service.get_or_create_profile(db_session, vendor.id)
    # bio + founding_year + certifications + tags = 4 of 5 fields (no photo)
    assert profile.profile_completeness == 80


@pytest.mark.asyncio
async def test_calculate_quality_score_no_data(db_session: AsyncSession):
    vendor = await _create_vendor(db_session)
    await vendor_profile_service.get_or_create_profile(db_session, vendor.id)

    score = await vendor_profile_service.calculate_quality_score(db_session, vendor.id)
    assert score == Decimal("0.00")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_vendor_profile_service.py -v -k "not test_vendor_tier"`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.vendor_profile_service'`

- [ ] **Step 3: Implement vendor_profile_service.py**

```python
# backend/app/services/vendor_profile_service.py
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    ReportStatus,
    VendorTier,
)
from app.models.report import Report
from app.models.request import ReportRequest, RequestAcceptance
from app.models.vendor_profile import VendorProfile, VendorRating


async def get_or_create_profile(
    db: AsyncSession, vendor_id: UUID
) -> VendorProfile:
    """Get or create a vendor profile with defaults."""
    result = await db.execute(
        select(VendorProfile).where(VendorProfile.vendor_id == vendor_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = VendorProfile(vendor_id=vendor_id)
        db.add(profile)
        await db.flush()
    return profile


async def update_profile(
    db: AsyncSession, vendor_id: UUID, *, updates: dict
) -> VendorProfile:
    """Update profile fields and recalculate completeness."""
    profile = await get_or_create_profile(db, vendor_id)
    for key, value in updates.items():
        if hasattr(profile, key):
            setattr(profile, key, value)
    profile.profile_completeness = _calc_completeness(profile)
    await db.flush()
    return profile


async def update_profile_photo(
    db: AsyncSession, vendor_id: UUID, photo_path: str
) -> VendorProfile:
    """Update the display photo path."""
    profile = await get_or_create_profile(db, vendor_id)
    profile.display_photo = photo_path
    profile.profile_completeness = _calc_completeness(profile)
    await db.flush()
    return profile


def _calc_completeness(profile: VendorProfile) -> int:
    """Calculate profile completeness percentage (5 fields)."""
    fields = [
        profile.display_photo,
        profile.bio,
        profile.founding_year,
        profile.certifications,
        profile.specialization_tags,
    ]
    filled = sum(1 for f in fields if f)
    return int((filled / len(fields)) * 100)


async def get_completed_jobs_count(
    db: AsyncSession, vendor_id: UUID
) -> int:
    """Count reports with PUBLISHED status for this vendor."""
    result = await db.execute(
        select(func.count(Report.id)).where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
        )
    )
    return result.scalar() or 0


async def get_first_time_acceptance_rate(
    db: AsyncSession, vendor_id: UUID
) -> float | None:
    """Percentage of requests accepted without revision."""
    # Total accepted requests for this vendor
    total_result = await db.execute(
        select(func.count(ReportRequest.id))
        .join(
            RequestAcceptance,
            RequestAcceptance.request_id == ReportRequest.id,
        )
        .where(
            RequestAcceptance.vendor_id == vendor_id,
            ReportRequest.lender_status == LenderRequestStatus.ACCEPTED,
        )
    )
    total = total_result.scalar() or 0
    if total == 0:
        return None

    # Requests that went through revision (SENT_FOR_REVIEW at any point)
    # We approximate by counting requests with revision reports
    from app.models.report import ReportRevision

    revised_result = await db.execute(
        select(func.count(func.distinct(ReportRevision.report_id)))
        .join(Report, Report.id == ReportRevision.report_id)
        .where(Report.vendor_id == vendor_id)
    )
    revised = revised_result.scalar() or 0

    first_time = total - revised
    return round((first_time / total) * 100, 1) if total > 0 else None


async def get_avg_turnaround_hours(
    db: AsyncSession, vendor_id: UUID
) -> float | None:
    """Average hours from acceptance to report submission."""
    result = await db.execute(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    Report.created_at - RequestAcceptance.accepted_at,
                )
                / 3600
            )
        )
        .join(
            RequestAcceptance,
            RequestAcceptance.report_id == Report.id,
        )
        .where(
            RequestAcceptance.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
        )
    )
    avg = result.scalar()
    return round(float(avg), 1) if avg is not None else None


async def get_on_time_delivery_rate(
    db: AsyncSession, vendor_id: UUID
) -> float | None:
    """Percentage of reports delivered within the requested eta_days."""
    result = await db.execute(
        select(
            func.count(RequestAcceptance.id).label("total"),
            func.count(
                func.nullif(
                    func.extract(
                        "epoch",
                        Report.created_at - RequestAcceptance.accepted_at,
                    )
                    <= ReportRequest.eta_days * 86400,
                    False,
                )
            ).label("on_time"),
        )
        .join(
            RequestAcceptance,
            RequestAcceptance.report_id == Report.id,
        )
        .join(
            ReportRequest,
            ReportRequest.id == RequestAcceptance.request_id,
        )
        .where(
            RequestAcceptance.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
            ReportRequest.eta_days.isnot(None),
        )
    )
    row = result.one()
    if row.total == 0:
        return None
    return round((row.on_time / row.total) * 100, 1)


async def get_ocr_completeness_rate(
    db: AsyncSession, vendor_id: UUID
) -> float | None:
    """Average OCR extraction completeness across reports."""
    from app.core.constants import REQUIRED_REPORT_FIELDS

    result = await db.execute(
        select(Report.content_json).where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
            Report.content_json.isnot(None),
        )
    )
    rows = result.scalars().all()
    if not rows:
        return None

    total_fields = len(REQUIRED_REPORT_FIELDS)
    completeness_sum = 0.0
    for content in rows:
        if content and isinstance(content, dict):
            filled = sum(
                1 for f in REQUIRED_REPORT_FIELDS if content.get(f)
            )
            completeness_sum += (filled / total_fields) * 100

    return round(completeness_sum / len(rows), 1)


async def calculate_quality_score(
    db: AsyncSession, vendor_id: UUID
) -> Decimal:
    """Calculate composite quality score (0-100)."""
    from app.services import vendor_rating_service

    avg_rating, rating_count = await vendor_rating_service.get_vendor_avg_rating(
        db, vendor_id
    )
    ftar = await get_first_time_acceptance_rate(db, vendor_id)
    otdr = await get_on_time_delivery_rate(db, vendor_id)
    ocr = await get_ocr_completeness_rate(db, vendor_id)

    # Need at least some data to calculate
    has_data = any(v is not None for v in [avg_rating, ftar, otdr, ocr])
    if not has_data:
        return Decimal("0.00")

    score = Decimal("0")

    # Lender rating (30%) — scale 1-5 to 0-100
    if avg_rating is not None:
        rating_pct = ((avg_rating - 1) / 4) * 100
        score += Decimal(str(rating_pct)) * Decimal("0.30")

    # First-time acceptance rate (25%)
    if ftar is not None:
        score += Decimal(str(ftar)) * Decimal("0.25")

    # On-time delivery rate (20%)
    if otdr is not None:
        score += Decimal(str(otdr)) * Decimal("0.20")

    # Revision rate inverse (15%) — lower revision = higher score
    if ftar is not None:
        revision_rate = 100 - ftar  # inverse of acceptance
        inverse_revision = 100 - revision_rate
        score += Decimal(str(inverse_revision)) * Decimal("0.15")

    # OCR completeness (10%)
    if ocr is not None:
        score += Decimal(str(ocr)) * Decimal("0.10")

    return round(score, 2)


async def recalculate_and_save_score(
    db: AsyncSession, vendor_id: UUID
) -> VendorProfile:
    """Recalculate quality score and save to profile."""
    profile = await get_or_create_profile(db, vendor_id)
    score = await calculate_quality_score(db, vendor_id)
    profile.quality_score = score
    await db.flush()
    return profile


async def check_tier_promotion(
    db: AsyncSession, vendor_id: UUID
) -> VendorProfile:
    """Check if vendor qualifies for tier promotion and apply it."""
    from datetime import datetime, timezone

    profile = await recalculate_and_save_score(db, vendor_id)
    completed_jobs = await get_completed_jobs_count(db, vendor_id)
    avg_turnaround = await get_avg_turnaround_hours(db, vendor_id)

    old_tier = profile.vendor_tier
    new_tier = old_tier

    if old_tier == VendorTier.NEW:
        if completed_jobs >= 10 and profile.quality_score >= Decimal("60"):
            new_tier = VendorTier.VERIFIED

    elif old_tier == VendorTier.VERIFIED:
        if (
            completed_jobs >= 50
            and profile.quality_score >= Decimal("80")
            and avg_turnaround is not None
            and avg_turnaround < 24
        ):
            new_tier = VendorTier.TOP_VALUER

    if new_tier != old_tier:
        profile.vendor_tier = new_tier
        profile.tier_changed_at = datetime.now(timezone.utc)
        profile.tier_warning_sent_at = None
        await db.flush()

    return profile


async def get_public_profile_data(
    db: AsyncSession, vendor_id: UUID
) -> dict:
    """Assemble all public profile data for a vendor."""
    from app.models.vendor import Vendor, ServiceArea
    from app.models.user import Organization
    from app.services import vendor_rating_service

    profile = await get_or_create_profile(db, vendor_id)

    # Vendor name
    result = await db.execute(
        select(Vendor, Organization.name.label("org_name"))
        .join(Organization, Organization.id == Vendor.organization_id)
        .where(Vendor.id == vendor_id)
    )
    row = result.one_or_none()
    if row is None:
        raise ValueError("Vendor not found")

    vendor_name = row.org_name

    # Stats
    completed_jobs = await get_completed_jobs_count(db, vendor_id)
    avg_rating, rating_count = await vendor_rating_service.get_vendor_avg_rating(
        db, vendor_id
    )
    ftar = await get_first_time_acceptance_rate(db, vendor_id)
    avg_turnaround = await get_avg_turnaround_hours(db, vendor_id)
    otdr = await get_on_time_delivery_rate(db, vendor_id)

    # Service areas
    sa_result = await db.execute(
        select(ServiceArea).where(ServiceArea.vendor_id == vendor_id)
    )
    service_areas = [
        {
            "city": sa.city,
            "areas": sa.areas,
            "service_type": sa.service_type.value,
        }
        for sa in sa_result.scalars().all()
    ]

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "display_photo": profile.display_photo,
        "bio": profile.bio,
        "founding_year": profile.founding_year,
        "certifications": profile.certifications,
        "specialization_tags": profile.specialization_tags,
        "quality_score": str(profile.quality_score),
        "vendor_tier": profile.vendor_tier.value,
        "total_completed_jobs": completed_jobs,
        "avg_rating": avg_rating,
        "rating_count": rating_count,
        "first_time_acceptance_rate": ftar,
        "avg_turnaround_hours": avg_turnaround,
        "on_time_delivery_rate": otdr,
        "service_areas": service_areas,
    }


async def get_portfolio(
    db: AsyncSession, vendor_id: UUID, *, page: int = 1, page_size: int = 20
) -> dict:
    """Get PII-redacted portfolio of completed reports."""
    count_result = await db.execute(
        select(func.count(Report.id)).where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
        )
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Report)
        .where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
        )
        .order_by(Report.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    entries = [
        {
            "report_category": r.report_category.value,
            "property_type": r.property_type.value if r.property_type else "UNKNOWN",
            "city": r.city or "Unknown",
            "area": r.area if hasattr(r, "area") else None,
            "completed_at": r.updated_at.isoformat(),
        }
        for r in result.scalars().all()
    ]

    return {
        "entries": entries,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_vendor_profile_service.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/vendor_profile_service.py backend/tests/services/test_vendor_profile_service.py
git commit -m "feat(phase13): add vendor profile service with quality score and tier promotion"
```

---

## Task 7: Create Vendor Profile API Router (Vendor-Side)

**Files:**
- Create: `backend/app/api/vendor/profile.py`

- [ ] **Step 1: Create the router**

```python
# backend/app/api/vendor/profile.py
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.vendor_profile import (
    TierProgressResponse,
    QualityScoreBreakdown,
    VendorProfileResponse,
    VendorProfileUpdate,
)
from app.services import vendor_profile_service, vendor_rating_service

router = APIRouter(prefix="/api/vendor/profile", tags=["vendor-profile"])

UPLOAD_DIR = "/app/uploads/profile_photos"


async def _get_vendor_id(db: AsyncSession, user_id: uuid.UUID) -> uuid.UUID:
    result = await db.execute(
        select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    )
    vendor_id = result.scalar_one_or_none()
    if not vendor_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_id


@router.get("", response_model=VendorProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    profile = await vendor_profile_service.get_or_create_profile(db, vendor_id)
    return profile


@router.put("", response_model=VendorProfileResponse)
async def update_profile(
    body: VendorProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    updates = body.model_dump(exclude_unset=True)
    # Convert certifications to dicts for JSONB storage
    if "certifications" in updates and updates["certifications"] is not None:
        updates["certifications"] = [
            c.model_dump() if hasattr(c, "model_dump") else c
            for c in updates["certifications"]
        ]
    profile = await vendor_profile_service.update_profile(
        db, vendor_id, updates=updates
    )
    return profile


@router.post("/photo", response_model=VendorProfileResponse)
async def upload_photo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    # Validate file type
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP images are allowed",
        )

    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename else "jpg"
    filename = f"{vendor_id}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    profile = await vendor_profile_service.update_profile_photo(
        db, vendor_id, f"/uploads/profile_photos/{filename}"
    )
    return profile


@router.get("/tier", response_model=TierProgressResponse)
async def get_tier_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    profile = await vendor_profile_service.get_or_create_profile(db, vendor_id)

    completed_jobs = await vendor_profile_service.get_completed_jobs_count(
        db, vendor_id
    )
    avg_rating, _ = await vendor_rating_service.get_vendor_avg_rating(
        db, vendor_id
    )
    ftar = await vendor_profile_service.get_first_time_acceptance_rate(
        db, vendor_id
    )
    otdr = await vendor_profile_service.get_on_time_delivery_rate(db, vendor_id)
    ocr = await vendor_profile_service.get_ocr_completeness_rate(db, vendor_id)
    avg_turnaround = await vendor_profile_service.get_avg_turnaround_hours(
        db, vendor_id
    )

    # Revision rate: inverse of first_time_acceptance_rate
    revision_rate = round(100 - ftar, 1) if ftar is not None else None

    breakdown = QualityScoreBreakdown(
        overall=str(profile.quality_score),
        lender_rating_avg=avg_rating,
        first_time_acceptance_rate=ftar,
        on_time_delivery_rate=otdr,
        revision_rate=revision_rate,
        ocr_completeness=ocr,
    )

    # Determine next tier requirements
    current_tier = profile.vendor_tier.value
    next_tier = None
    next_requirements = None

    if profile.vendor_tier == VendorTier.NEW:
        next_tier = "VERIFIED"
        next_requirements = {
            "completed_jobs": {"required": 10, "current": completed_jobs},
            "quality_score": {
                "required": 60,
                "current": float(profile.quality_score),
            },
        }
    elif profile.vendor_tier == VendorTier.VERIFIED:
        next_tier = "TOP_VALUER"
        next_requirements = {
            "completed_jobs": {"required": 50, "current": completed_jobs},
            "quality_score": {
                "required": 80,
                "current": float(profile.quality_score),
            },
            "avg_response_time_hours": {
                "required": 24,
                "current": avg_turnaround,
            },
        }

    return TierProgressResponse(
        current_tier=current_tier,
        tier_since=profile.tier_changed_at,
        completed_jobs=completed_jobs,
        quality_score=str(profile.quality_score),
        avg_response_time_hours=avg_turnaround,
        next_tier=next_tier,
        next_tier_requirements=next_requirements,
        quality_breakdown=breakdown,
    )
```

Add the missing import at the top of the file:

```python
from app.models.enums import VendorTier
```

- [ ] **Step 2: Verify the router module imports**

Run: `cd backend && python -c "from app.api.vendor.profile import router; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/vendor/profile.py
git commit -m "feat(phase13): add vendor-side profile API router (get/update/photo/tier)"
```

---

## Task 8: Create Lender-Side Vendor API Router

**Files:**
- Create: `backend/app/api/lender/vendors.py`

- [ ] **Step 1: Create the router**

```python
# backend/app/api/lender/vendors.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.enums import LenderRequestStatus
from app.models.lender import LenderUser
from app.models.request import ReportRequest, RequestAcceptance
from app.models.user import User
from app.schemas.vendor_profile import (
    PortfolioResponse,
    RatingSummary,
    VendorPublicProfile,
    VendorRatingCreate,
    VendorRatingResponse,
)
from app.services import vendor_profile_service, vendor_rating_service

router = APIRouter(prefix="/api/lender/vendors", tags=["lender-vendors"])


async def _get_lender_user(db: AsyncSession, user_id: uuid.UUID) -> LenderUser:
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == user_id)
    )
    lu = result.scalar_one_or_none()
    if not lu:
        raise HTTPException(status_code=404, detail="Lender user not found")
    return lu


@router.get("/{vendor_id}/profile", response_model=VendorPublicProfile)
async def get_vendor_public_profile(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    try:
        data = await vendor_profile_service.get_public_profile_data(db, vendor_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return data


@router.get("/{vendor_id}/portfolio", response_model=PortfolioResponse)
async def get_vendor_portfolio(
    vendor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    data = await vendor_profile_service.get_portfolio(
        db, vendor_id, page=page, page_size=page_size
    )
    return data


@router.post("/{vendor_id}/rate", response_model=VendorRatingResponse, status_code=201)
async def submit_rating(
    vendor_id: uuid.UUID,
    body: VendorRatingCreate,
    report_request_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    # Verify the request exists and is accepted
    result = await db.execute(
        select(ReportRequest).where(
            ReportRequest.id == report_request_id,
            ReportRequest.lender_status == LenderRequestStatus.ACCEPTED,
        )
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(
            status_code=404,
            detail="Accepted request not found",
        )

    # Verify vendor was the one who fulfilled this request
    accept_result = await db.execute(
        select(RequestAcceptance).where(
            RequestAcceptance.request_id == report_request_id,
            RequestAcceptance.vendor_id == vendor_id,
        )
    )
    if not accept_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="This vendor did not fulfill this request",
        )

    rating = await vendor_rating_service.submit_rating(
        db,
        lender_user_id=current_user.id,
        vendor_id=vendor_id,
        report_request_id=report_request_id,
        rating=body.rating,
    )

    # Recalculate quality score and check tier promotion
    await vendor_profile_service.check_tier_promotion(db, vendor_id)

    return rating


@router.get("/{vendor_id}/ratings", response_model=RatingSummary)
async def get_vendor_ratings(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    avg_rating, rating_count = await vendor_rating_service.get_vendor_avg_rating(
        db, vendor_id
    )
    distribution = await vendor_rating_service.get_rating_distribution(
        db, vendor_id
    )
    return RatingSummary(
        avg_rating=avg_rating,
        rating_count=rating_count,
        distribution=distribution,
    )
```

- [ ] **Step 2: Verify the router module imports**

Run: `cd backend && python -c "from app.api.lender.vendors import router; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/lender/vendors.py
git commit -m "feat(phase13): add lender-side vendor API (public profile, portfolio, rating)"
```

---

## Task 9: Create Admin Tier Override Endpoint

**Files:**
- Create: `backend/app/api/admin/vendor_tiers.py`

- [ ] **Step 1: Create the admin router**

```python
# backend/app/api/admin/vendor_tiers.py
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.enums import VendorTier
from app.models.user import User
from app.services import vendor_profile_service

router = APIRouter(prefix="/api/admin/vendors", tags=["admin-vendor-tiers"])


class TierOverrideRequest(BaseModel):
    tier: str
    reason: str


@router.put("/{vendor_id}/tier")
async def override_vendor_tier(
    vendor_id: uuid.UUID,
    body: TierOverrideRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    try:
        new_tier = VendorTier(body.tier)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Must be one of: {[t.value for t in VendorTier]}",
        )

    profile = await vendor_profile_service.get_or_create_profile(db, vendor_id)
    old_tier = profile.vendor_tier.value
    profile.vendor_tier = new_tier
    profile.tier_changed_at = datetime.now(timezone.utc)
    profile.tier_warning_sent_at = None
    await db.flush()

    return {
        "vendor_id": str(vendor_id),
        "old_tier": old_tier,
        "new_tier": new_tier.value,
        "reason": body.reason,
        "changed_by": str(current_user.id),
    }
```

- [ ] **Step 2: Verify the router module imports**

Run: `cd backend && python -c "from app.api.admin.vendor_tiers import router; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/admin/vendor_tiers.py
git commit -m "feat(phase13): add admin vendor tier override endpoint"
```

---

## Task 10: Register Routers in main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add router imports and registration**

Add imports after the existing router imports in `backend/app/main.py`:

```python
from app.api.vendor.profile import router as vendor_profile_router
from app.api.lender.vendors import router as lender_vendors_router
from app.api.admin.vendor_tiers import router as admin_vendor_tiers_router
```

Add router registration at the end of the `app.include_router(...)` block:

```python
app.include_router(vendor_profile_router)
app.include_router(lender_vendors_router)
app.include_router(admin_vendor_tiers_router)
```

- [ ] **Step 2: Verify app starts**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local restart backend
docker compose -f docker-compose.local.yml --env-file .env.local logs backend --tail 20
```

Expected: No import errors, app starts successfully.

- [ ] **Step 3: Smoke test endpoints**

```bash
curl -s http://localhost:8020/api/health | python3 -m json.tool
curl -s http://localhost:8020/docs | head -5
```

Expected: Health check returns `{"status": "ok"}`, docs page loads.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(phase13): register vendor profile and lender vendors routers"
```

---

## Task 11: Create Frontend Types

**Files:**
- Create: `frontend/src/types/vendor-profile.ts`

- [ ] **Step 1: Create the types file**

```typescript
// frontend/src/types/vendor-profile.ts

export interface CertificationEntry {
  name: string;
  registration_number?: string;
  issued_by?: string;
  year?: number;
}

export interface VendorProfileResponse {
  id: string;
  vendor_id: string;
  display_photo: string | null;
  bio: string | null;
  founding_year: number | null;
  certifications: CertificationEntry[] | null;
  specialization_tags: string[] | null;
  quality_score: string;
  vendor_tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  tier_changed_at: string | null;
  profile_completeness: number;
}

export interface VendorProfileUpdate {
  bio?: string;
  founding_year?: number;
  certifications?: CertificationEntry[];
  specialization_tags?: string[];
}

export interface VendorPublicProfile {
  vendor_id: string;
  vendor_name: string;
  display_photo: string | null;
  bio: string | null;
  founding_year: number | null;
  certifications: CertificationEntry[] | null;
  specialization_tags: string[] | null;
  quality_score: string;
  vendor_tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  total_completed_jobs: number;
  avg_rating: number | null;
  rating_count: number;
  first_time_acceptance_rate: number | null;
  avg_turnaround_hours: number | null;
  on_time_delivery_rate: number | null;
  service_areas: ServiceAreaEntry[];
}

export interface ServiceAreaEntry {
  city: string;
  areas: string[] | null;
  service_type: string;
}

export interface PortfolioEntry {
  report_category: string;
  property_type: string;
  city: string;
  area: string | null;
  completed_at: string;
}

export interface PortfolioResponse {
  entries: PortfolioEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface VendorRatingResponse {
  id: string;
  lender_user_id: string;
  vendor_id: string;
  report_request_id: string;
  rating: number;
  created_at: string;
}

export interface RatingSummary {
  avg_rating: number | null;
  rating_count: number;
  distribution: Record<string, number>;
}

export interface QualityScoreBreakdown {
  overall: string;
  lender_rating_avg: number | null;
  lender_rating_weight: number;
  first_time_acceptance_rate: number | null;
  first_time_acceptance_weight: number;
  on_time_delivery_rate: number | null;
  on_time_delivery_weight: number;
  revision_rate: number | null;
  revision_rate_weight: number;
  ocr_completeness: number | null;
  ocr_completeness_weight: number;
}

export interface TierProgressResponse {
  current_tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  tier_since: string | null;
  completed_jobs: number;
  quality_score: string;
  avg_response_time_hours: number | null;
  next_tier: string | null;
  next_tier_requirements: Record<string, { required: number; current: number | null }> | null;
  quality_breakdown: QualityScoreBreakdown;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/vendor-profile.ts
git commit -m "feat(phase13): add TypeScript types for vendor profile, rating, and tier"
```

---

## Task 12: Create Reusable UI Components

**Files:**
- Create: `frontend/src/components/tier-badge.tsx`
- Create: `frontend/src/components/rating-stars.tsx`
- Create: `frontend/src/components/rating-modal.tsx`

- [ ] **Step 1: Create TierBadge component**

```tsx
// frontend/src/components/tier-badge.tsx
"use client";

import { Shield, ShieldCheck, Award } from "lucide-react";

const TIER_CONFIG = {
  NEW: {
    label: "New",
    icon: Shield,
    className: "bg-gray-100 text-gray-700 border-gray-300",
  },
  VERIFIED: {
    label: "Verified",
    icon: ShieldCheck,
    className: "bg-blue-50 text-blue-700 border-blue-300",
  },
  TOP_VALUER: {
    label: "Top Valuer",
    icon: Award,
    className: "bg-amber-50 text-amber-700 border-amber-300",
  },
} as const;

interface TierBadgeProps {
  tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = { sm: 12, md: 14, lg: 16 };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.className} ${sizeClasses[size]}`}
    >
      <Icon size={iconSizes[size]} />
      {config.label}
    </span>
  );
}
```

- [ ] **Step 2: Create RatingStars component**

```tsx
// frontend/src/components/rating-stars.tsx
"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface RatingStarsDisplayProps {
  rating: number;
  count?: number;
  size?: number;
}

export function RatingStarsDisplay({
  rating,
  count,
  size = 16,
}: RatingStarsDisplayProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-gray-300"
          }
        />
      ))}
      {count !== undefined && (
        <span className="text-sm text-gray-500 ml-1">({count})</span>
      )}
    </span>
  );
}

interface RatingStarsInputProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}

export function RatingStarsInput({
  value,
  onChange,
  size = 28,
}: RatingStarsInputProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 transition-transform hover:scale-110"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star
            size={size}
            className={
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300"
            }
          />
        </button>
      ))}
    </span>
  );
}
```

- [ ] **Step 3: Create RatingModal component**

```tsx
// frontend/src/components/rating-modal.tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { RatingStarsInput } from "./rating-stars";

interface RatingModalProps {
  vendorId: string;
  vendorName: string;
  reportRequestId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function RatingModal({
  vendorId,
  vendorName,
  reportRequestId,
  onClose,
  onSubmitted,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(
        `/api/lender/vendors/${vendorId}/rate?report_request_id=${reportRequestId}`,
        { rating }
      );
      toast.success("Rating submitted");
      onSubmitted?.();
      onClose();
    } catch {
      toast.error("Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Rate {vendorName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          How was your experience with this vendor&apos;s report?
        </p>

        <div className="flex justify-center mb-6">
          <RatingStarsInput value={rating} onChange={setRating} size={36} />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/tier-badge.tsx frontend/src/components/rating-stars.tsx frontend/src/components/rating-modal.tsx
git commit -m "feat(phase13): add TierBadge, RatingStars, and RatingModal components"
```

---

## Task 13: Create Vendor Profile Editor Page

**Files:**
- Create: `frontend/src/app/vendor/profile/page.tsx`
- Create: `frontend/src/app/vendor/profile/_components/profile-form.tsx`
- Create: `frontend/src/app/vendor/profile/_components/profile-photo-upload.tsx`

- [ ] **Step 1: Create the profile page**

```tsx
// frontend/src/app/vendor/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { VendorProfileResponse } from "@/types/vendor-profile";
import { ProfileForm } from "./_components/profile-form";
import { ProfilePhotoUpload } from "./_components/profile-photo-upload";
import { TierBadge } from "@/components/tier-badge";

export default function VendorProfilePage() {
  const [profile, setProfile] = useState<VendorProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const data = await api.get<VendorProfileResponse>("/api/vendor/profile");
      setProfile(data);
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!profile) return <p className="p-6">Profile not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            Completeness: {profile.profile_completeness}%
          </p>
        </div>
        <TierBadge tier={profile.vendor_tier} size="lg" />
      </div>

      {/* Completeness progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${profile.profile_completeness}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ProfilePhotoUpload
            currentPhoto={profile.display_photo}
            onUploaded={loadProfile}
          />
        </div>
        <div className="lg:col-span-2">
          <ProfileForm profile={profile} onUpdated={loadProfile} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the photo upload component**

```tsx
// frontend/src/app/vendor/profile/_components/profile-photo-upload.tsx
"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface ProfilePhotoUploadProps {
  currentPhoto: string | null;
  onUploaded: () => void;
}

export function ProfilePhotoUpload({
  currentPhoto,
  onUploaded,
}: ProfilePhotoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      await api.upload("/api/vendor/profile/photo", formData);
      toast.success("Photo updated");
      onUploaded();
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const photoUrl = currentPhoto
    ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}${currentPhoto}`
    : null;

  return (
    <div className="bg-white rounded-lg border p-6 text-center">
      <div className="relative inline-block">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 mx-auto">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-gray-400">
              <Camera size={40} />
            </div>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 disabled:opacity-50"
        >
          <Camera size={16} />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
      />
      <p className="text-xs text-gray-500 mt-3">
        {uploading ? "Uploading..." : "JPEG, PNG, or WebP"}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create the profile form component**

```tsx
// frontend/src/app/vendor/profile/_components/profile-form.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  VendorProfileResponse,
  VendorProfileUpdate,
  CertificationEntry,
} from "@/types/vendor-profile";
import { Plus, Trash2 } from "lucide-react";

interface ProfileFormProps {
  profile: VendorProfileResponse;
  onUpdated: () => void;
}

export function ProfileForm({ profile, onUpdated }: ProfileFormProps) {
  const [bio, setBio] = useState(profile.bio || "");
  const [foundingYear, setFoundingYear] = useState(
    profile.founding_year?.toString() || ""
  );
  const [tags, setTags] = useState<string[]>(
    profile.specialization_tags || []
  );
  const [tagInput, setTagInput] = useState("");
  const [certs, setCerts] = useState<CertificationEntry[]>(
    profile.certifications || []
  );
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const addCert = () => {
    setCerts([...certs, { name: "", registration_number: "" }]);
  };

  const updateCert = (
    index: number,
    field: keyof CertificationEntry,
    value: string | number
  ) => {
    const updated = [...certs];
    updated[index] = { ...updated[index], [field]: value };
    setCerts(updated);
  };

  const removeCert = (index: number) => {
    setCerts(certs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: VendorProfileUpdate = {
        bio: bio || undefined,
        founding_year: foundingYear ? parseInt(foundingYear) : undefined,
        specialization_tags: tags.length > 0 ? tags : undefined,
        certifications: certs.length > 0 ? certs : undefined,
      };
      await api.put("/api/vendor/profile", body);
      toast.success("Profile updated");
      onUpdated();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          About / Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full border rounded-lg p-3 text-sm"
          placeholder="Tell lenders about your experience and expertise..."
        />
      </div>

      {/* Founding Year */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Founding Year
        </label>
        <input
          type="number"
          value={foundingYear}
          onChange={(e) => setFoundingYear(e.target.value)}
          min={1950}
          max={new Date().getFullYear()}
          className="w-full border rounded-lg p-3 text-sm"
          placeholder="e.g. 2015"
        />
      </div>

      {/* Specialization Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Specializations
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-blue-400 hover:text-blue-600"
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            className="flex-1 border rounded-lg p-3 text-sm"
            placeholder="e.g. Residential, Commercial, Heritage..."
          />
          <button
            type="button"
            onClick={addTag}
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
          >
            Add
          </button>
        </div>
      </div>

      {/* Certifications */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Certifications
        </label>
        <div className="space-y-3">
          {certs.map((cert, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                value={cert.name}
                onChange={(e) => updateCert(i, "name", e.target.value)}
                className="flex-1 border rounded-lg p-2 text-sm"
                placeholder="Certification name (e.g. IBBI)"
              />
              <input
                value={cert.registration_number || ""}
                onChange={(e) =>
                  updateCert(i, "registration_number", e.target.value)
                }
                className="flex-1 border rounded-lg p-2 text-sm"
                placeholder="Registration number"
              />
              <button
                type="button"
                onClick={() => removeCert(i)}
                className="text-red-400 hover:text-red-600 p-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCert}
          className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus size={14} /> Add certification
        </button>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/vendor/profile/
git commit -m "feat(phase13): add vendor profile editor page with photo upload and form"
```

---

## Task 14: Create Vendor Dashboard Tier and Quality Score Cards

**Files:**
- Create: `frontend/src/app/vendor/dashboard/_components/tier-card.tsx`
- Create: `frontend/src/app/vendor/dashboard/_components/quality-score-card.tsx`
- Modify: `frontend/src/app/vendor/dashboard/page.tsx`

- [ ] **Step 1: Create TierCard component**

```tsx
// frontend/src/app/vendor/dashboard/_components/tier-card.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TierProgressResponse } from "@/types/vendor-profile";
import { TierBadge } from "@/components/tier-badge";

export function TierCard() {
  const [data, setData] = useState<TierProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TierProgressResponse>("/api/vendor/profile/tier")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-lg border p-6 animate-pulse h-48" />;
  if (!data) return null;

  const reqs = data.next_tier_requirements;

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Trust Tier</h3>
        <TierBadge tier={data.current_tier} />
      </div>

      {data.tier_since && (
        <p className="text-xs text-gray-500 mb-4">
          Since {new Date(data.tier_since).toLocaleDateString()}
        </p>
      )}

      {data.next_tier && reqs && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Progress to {data.next_tier.replace("_", " ")}
          </p>
          {Object.entries(reqs).map(([key, val]) => {
            const current = val.current ?? 0;
            const pct = Math.min((current / val.required) * 100, 100);
            const label = key.replace(/_/g, " ");
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span className="capitalize">{label}</span>
                  <span>
                    {typeof current === "number" ? Math.round(current * 10) / 10 : 0} / {val.required}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      pct >= 100 ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!data.next_tier && (
        <p className="text-sm text-green-600 font-medium">
          You&apos;ve reached the highest tier!
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create QualityScoreCard component**

```tsx
// frontend/src/app/vendor/dashboard/_components/quality-score-card.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TierProgressResponse } from "@/types/vendor-profile";

export function QualityScoreCard() {
  const [data, setData] = useState<TierProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TierProgressResponse>("/api/vendor/profile/tier")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-lg border p-6 animate-pulse h-48" />;
  if (!data) return null;

  const b = data.quality_breakdown;
  const score = parseFloat(b.overall);

  const signals = [
    {
      label: "Lender Rating",
      value: b.lender_rating_avg != null ? `${b.lender_rating_avg}/5` : "N/A",
      weight: b.lender_rating_weight,
    },
    {
      label: "First-Time Acceptance",
      value: b.first_time_acceptance_rate != null ? `${b.first_time_acceptance_rate}%` : "N/A",
      weight: b.first_time_acceptance_weight,
    },
    {
      label: "On-Time Delivery",
      value: b.on_time_delivery_rate != null ? `${b.on_time_delivery_rate}%` : "N/A",
      weight: b.on_time_delivery_weight,
    },
    {
      label: "Revision Rate",
      value: b.revision_rate != null ? `${b.revision_rate}%` : "N/A",
      weight: b.revision_rate_weight,
    },
    {
      label: "OCR Completeness",
      value: b.ocr_completeness != null ? `${b.ocr_completeness}%` : "N/A",
      weight: b.ocr_completeness_weight,
    },
  ];

  const scoreColor =
    score >= 80 ? "text-green-600" : score >= 60 ? "text-blue-600" : score > 0 ? "text-amber-600" : "text-gray-400";

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Quality Score</h3>
        <span className={`text-2xl font-bold ${scoreColor}`}>
          {score > 0 ? Math.round(score) : "—"}
          <span className="text-sm font-normal text-gray-400">/100</span>
        </span>
      </div>

      <div className="space-y-2">
        {signals.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{s.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{s.value}</span>
              <span className="text-xs text-gray-400">({s.weight}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add cards to vendor dashboard page**

In `frontend/src/app/vendor/dashboard/page.tsx`, add imports:

```typescript
import { TierCard } from "./_components/tier-card";
import { QualityScoreCard } from "./_components/quality-score-card";
```

Add the cards after `<VendorStats />` and before `<PendingRequestsTable />`:

```tsx
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TierCard />
        <QualityScoreCard />
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/vendor/dashboard/_components/tier-card.tsx frontend/src/app/vendor/dashboard/_components/quality-score-card.tsx frontend/src/app/vendor/dashboard/page.tsx
git commit -m "feat(phase13): add tier progress and quality score cards to vendor dashboard"
```

---

## Task 15: Create Lender Public Vendor Profile Page

**Files:**
- Create: `frontend/src/app/lender/vendors/[id]/page.tsx`
- Create: `frontend/src/app/lender/vendors/[id]/_components/vendor-portfolio.tsx`
- Create: `frontend/src/app/lender/vendors/[id]/_components/vendor-stats-bar.tsx`

- [ ] **Step 1: Create the vendor stats bar component**

```tsx
// frontend/src/app/lender/vendors/[id]/_components/vendor-stats-bar.tsx
"use client";

import { VendorPublicProfile } from "@/types/vendor-profile";
import { Briefcase, Clock, CheckCircle, TrendingUp } from "lucide-react";

interface VendorStatsBarProps {
  profile: VendorPublicProfile;
}

export function VendorStatsBar({ profile }: VendorStatsBarProps) {
  const stats = [
    {
      icon: Briefcase,
      label: "Completed Jobs",
      value: profile.total_completed_jobs.toString(),
    },
    {
      icon: Clock,
      label: "Avg Turnaround",
      value: profile.avg_turnaround_hours != null
        ? `${Math.round(profile.avg_turnaround_hours)}hrs`
        : "N/A",
    },
    {
      icon: CheckCircle,
      label: "First-Time Accept",
      value: profile.first_time_acceptance_rate != null
        ? `${profile.first_time_acceptance_rate}%`
        : "N/A",
    },
    {
      icon: TrendingUp,
      label: "On-Time Delivery",
      value: profile.on_time_delivery_rate != null
        ? `${profile.on_time_delivery_rate}%`
        : "N/A",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border rounded-lg p-4 text-center">
          <s.icon className="mx-auto text-blue-500 mb-2" size={20} />
          <p className="text-lg font-bold">{s.value}</p>
          <p className="text-xs text-gray-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the portfolio component**

```tsx
// frontend/src/app/lender/vendors/[id]/_components/vendor-portfolio.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PortfolioResponse } from "@/types/vendor-profile";

interface VendorPortfolioProps {
  vendorId: string;
}

export function VendorPortfolio({ vendorId }: VendorPortfolioProps) {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<PortfolioResponse>(
        `/api/lender/vendors/${vendorId}/portfolio?page=${page}&page_size=10`
      )
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendorId, page]);

  if (loading) return <p className="text-sm text-gray-500">Loading portfolio...</p>;
  if (!data || data.entries.length === 0)
    return <p className="text-sm text-gray-500">No completed reports yet.</p>;

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Portfolio ({data.total} reports)
      </h3>
      <div className="space-y-2">
        {data.entries.map((entry, i) => (
          <div
            key={i}
            className="flex items-center justify-between border rounded-lg p-3 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                {entry.property_type}
              </span>
              <span className="bg-gray-50 text-gray-700 text-xs px-2 py-0.5 rounded">
                {entry.report_category}
              </span>
              <span className="text-gray-600">{entry.city}</span>
              {entry.area && (
                <span className="text-gray-400">{entry.area}</span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {new Date(entry.completed_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the public profile page**

```tsx
// frontend/src/app/lender/vendors/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { VendorPublicProfile, RatingSummary } from "@/types/vendor-profile";
import { TierBadge } from "@/components/tier-badge";
import { RatingStarsDisplay } from "@/components/rating-stars";
import { VendorStatsBar } from "./_components/vendor-stats-bar";
import { VendorPortfolio } from "./_components/vendor-portfolio";

export default function VendorPublicProfilePage() {
  const params = useParams();
  const vendorId = params.id as string;

  const [profile, setProfile] = useState<VendorPublicProfile | null>(null);
  const [ratings, setRatings] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<VendorPublicProfile>(
        `/api/lender/vendors/${vendorId}/profile`
      ),
      api.get<RatingSummary>(
        `/api/lender/vendors/${vendorId}/ratings`
      ),
    ])
      .then(([p, r]) => {
        setProfile(p);
        setRatings(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendorId]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!profile) return <p className="p-6">Vendor not found</p>;

  const photoUrl = profile.display_photo
    ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}${profile.display_photo}`
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/lender/requests"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back
      </Link>

      {/* Profile Header */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Photo */}
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={profile.vendor_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-2xl font-bold text-gray-400">
                {profile.vendor_name.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h1 className="text-xl font-bold">{profile.vendor_name}</h1>
              <TierBadge tier={profile.vendor_tier} />
            </div>

            {profile.avg_rating != null && (
              <div className="mb-2">
                <RatingStarsDisplay
                  rating={profile.avg_rating}
                  count={profile.rating_count}
                />
              </div>
            )}

            {profile.bio && (
              <p className="text-sm text-gray-600 mb-3">{profile.bio}</p>
            )}

            {/* Specialization Tags */}
            {profile.specialization_tags &&
              profile.specialization_tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {profile.specialization_tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

            {/* Service Areas */}
            {profile.service_areas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.service_areas.map((sa, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs text-gray-500"
                  >
                    <MapPin size={12} />
                    {sa.city}
                    {sa.areas && sa.areas.length > 0
                      ? ` (${sa.areas.join(", ")})`
                      : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <VendorStatsBar profile={profile} />

      {/* Rating Distribution */}
      {ratings && ratings.rating_count > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Rating Distribution
          </h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratings.distribution[star.toString()] || 0;
              const pct =
                ratings.rating_count > 0
                  ? (count / ratings.rating_count) * 100
                  : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-right text-gray-600">{star}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-gray-500">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Portfolio */}
      <div className="bg-white border rounded-lg p-6">
        <VendorPortfolio vendorId={vendorId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/lender/vendors/
git commit -m "feat(phase13): add lender-facing public vendor profile page with stats and portfolio"
```

---

## Task 16: Add Vendor Profile Link to Sidebar Navigation

**Files:**
- Modify: Vendor sidebar/layout component (find the existing vendor layout)

- [ ] **Step 1: Find and update the vendor sidebar**

Locate the vendor layout file (likely `frontend/src/app/vendor/layout.tsx` or a shared sidebar component). Add a "Profile" navigation link:

```typescript
{ label: "Profile", href: "/vendor/profile", icon: UserCircle }
```

Add it between existing navigation items (e.g., after "Dashboard" and before "Requests").

Import `UserCircle` from `lucide-react` if not already imported.

- [ ] **Step 2: Verify navigation works**

Start the frontend dev server and verify:
- Vendor sidebar shows "Profile" link
- Clicking it navigates to `/vendor/profile`
- Profile page loads and shows the edit form

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/vendor/layout.tsx
git commit -m "feat(phase13): add Profile link to vendor sidebar navigation"
```

---

## Task 17: Wire Rating Prompt into Lender Request Detail

**Files:**
- Modify: Lender request detail page/component

- [ ] **Step 1: Find the lender request detail page**

Locate the lender request detail component (likely `frontend/src/app/lender/requests/[id]/page.tsx` or its `_components/`). Add rating modal trigger.

Add state and import at the top of the component:

```typescript
import { RatingModal } from "@/components/rating-modal";
// Add state
const [showRating, setShowRating] = useState(false);
```

After the "Accept" action (when request status is `ACCEPTED`), add a "Rate Vendor" button:

```tsx
{request.lender_status === "ACCEPTED" && vendorId && vendorName && (
  <>
    <button
      onClick={() => setShowRating(true)}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
    >
      Rate Vendor
    </button>
    {showRating && (
      <RatingModal
        vendorId={vendorId}
        vendorName={vendorName}
        reportRequestId={request.id}
        onClose={() => setShowRating(false)}
        onSubmitted={() => {/* optionally reload */}}
      />
    )}
  </>
)}
```

Note: `vendorId` and `vendorName` should come from the request's acceptance data. Check the existing request detail component to find where vendor info is available and adapt variable names accordingly.

- [ ] **Step 2: Verify the rating flow works**

1. Log in as lender (lender@abcl.com / lender123)
2. Navigate to a request with ACCEPTED status
3. Click "Rate Vendor"
4. Select stars, submit
5. Verify toast shows success

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/requests/
git commit -m "feat(phase13): add vendor rating prompt to lender request detail page"
```

---

## Task 18: End-to-End Verification

- [ ] **Step 1: Rebuild containers**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
make migrate
make seed
```

- [ ] **Step 2: Verify backend endpoints**

```bash
# Login as vendor
TOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vendor@valuepro.com","password":"vendor123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Get vendor profile
curl -s http://localhost:8020/api/vendor/profile \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Get tier progress
curl -s http://localhost:8020/api/vendor/profile/tier \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Login as lender
LTOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lender@abcl.com","password":"lender123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Get vendor public profile (replace VENDOR_ID from profile response)
curl -s http://localhost:8020/api/lender/vendors/VENDOR_ID/profile \
  -H "Authorization: Bearer $LTOKEN" | python3 -m json.tool
```

- [ ] **Step 3: Verify frontend pages**

1. Open http://localhost:3020/vendor/login, log in as vendor
2. Check dashboard — TierCard and QualityScoreCard should appear
3. Navigate to /vendor/profile — profile editor should load
4. Fill in bio, add specialization tags, save — verify completeness updates
5. Open http://localhost:3020/lender/login, log in as lender
6. Navigate to /lender/vendors/{vendor_id} — public profile should show

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/test_vendor_profile_service.py tests/services/test_vendor_rating_service.py -v
```

Expected: All tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(phase13): complete vendor profiles and trust foundation"
```
