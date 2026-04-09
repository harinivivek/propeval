# Phase 2: Pricing & Report Models — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete data layer for reports, listings, requests, pricing, and billing, plus a pricing calculation service and admin pricing CRUD UI.

**Architecture:** 11 new SQLAlchemy models across 5 files, 4 new enums, a pricing service with area-fallback lookup, admin API (5 endpoints), and a basic admin pricing page (table + form). All models use the existing BaseModel (UUID PK + timestamps) pattern.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, Next.js 15 (App Router), TypeScript, Tailwind CSS 4

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/pricing.py` | PricingRule model |
| `backend/app/models/report.py` | Report, ReportRevision models |
| `backend/app/models/listing.py` | Listing, ListingReport models |
| `backend/app/models/request.py` | ReportRequest, RequestBroadcast, RequestAcceptance models |
| `backend/app/models/billing.py` | VendorEarning, LenderPayable, Invoice models |
| `backend/app/schemas/pricing.py` | Pricing Pydantic schemas |
| `backend/app/schemas/report.py` | Report Pydantic schemas |
| `backend/app/schemas/listing.py` | Listing Pydantic schemas |
| `backend/app/schemas/request.py` | Request Pydantic schemas |
| `backend/app/schemas/billing.py` | Billing Pydantic schemas |
| `backend/app/services/pricing_service.py` | Pricing CRUD + calculation with area fallback |
| `backend/app/api/admin/pricing.py` | Admin pricing API router (5 endpoints) |
| `backend/tests/api/test_pricing.py` | Pricing API integration tests |
| `backend/tests/services/test_pricing_service.py` | Pricing service unit tests |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/enums.py` | Add EarningType, PayableType, InvoiceType, BroadcastStatus enums |
| `backend/app/models/__init__.py` | Register all new models + enums |
| `backend/app/main.py` | Register admin pricing router |
| `backend/scripts/seed.py` | Add sample pricing rules |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/types/pricing.ts` | PricingRule TypeScript interface |
| `frontend/src/app/admin/pricing/page.tsx` | Admin pricing management page |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/app/admin/layout.tsx` | Add "Pricing" nav link |

---

## Task 1: Add New Enums

**Files:**
- Modify: `backend/app/models/enums.py`

- [ ] **Step 1: Add the four new enum classes to enums.py**

Add at the end of `backend/app/models/enums.py`:

```python
class EarningType(str, Enum):
    REQUEST = "REQUEST"
    LISTING_DOWNLOAD = "LISTING_DOWNLOAD"


class PayableType(str, Enum):
    NEW_REQUEST = "NEW_REQUEST"
    LISTING_DOWNLOAD = "LISTING_DOWNLOAD"
    UPDATE = "UPDATE"
    NEARBY = "NEARBY"


class InvoiceType(str, Enum):
    PAYABLE = "PAYABLE"
    RECEIVABLE = "RECEIVABLE"


class BroadcastStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    ACCEPTED = "ACCEPTED"
```

- [ ] **Step 2: Verify the file is valid Python**

Run: `cd /home/yogidigital/projects/propeval && docker compose -f docker-compose.local.yml exec backend python -c "from app.models.enums import EarningType, PayableType, InvoiceType, BroadcastStatus; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/enums.py
git commit -m "feat: add Phase 2 enums (EarningType, PayableType, InvoiceType, BroadcastStatus)"
```

---

## Task 2: PricingRule Model

**Files:**
- Create: `backend/app/models/pricing.py`

- [ ] **Step 1: Create the PricingRule model**

Create `backend/app/models/pricing.py`:

```python
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import PropertyType, ReportCategory


class PricingRule(BaseModel):
    __tablename__ = "pricing_rules"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    city: Mapped[str] = mapped_column(String(255))
    area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    new_request_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    listing_download_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    update_additional_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    nearby_additional_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        # Unique constraint for rows WITH area
        UniqueConstraint(
            "lender_id", "report_category", "city", "area", "property_type",
            name="uq_pricing_rule_with_area",
        ),
        # Partial unique index for rows WITHOUT area (NULL)
        Index(
            "uq_pricing_rule_without_area",
            "lender_id", "report_category", "city", "property_type",
            unique=True,
            postgresql_where="area IS NULL",
        ),
    )
```

- [ ] **Step 2: Verify the model imports cleanly**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.models.pricing import PricingRule; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/pricing.py
git commit -m "feat: add PricingRule model with area fallback unique constraints"
```

---

## Task 3: Report & ReportRevision Models

**Files:**
- Create: `backend/app/models/report.py`

- [ ] **Step 1: Create the Report and ReportRevision models**

Create `backend/app/models/report.py`:

```python
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import PropertyType, ReportCategory, ReportStatus


class Report(BaseModel):
    __tablename__ = "reports"

    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    status: Mapped[ReportStatus] = mapped_column(
        SQLEnum(ReportStatus), default=ReportStatus.UPLOADED
    )
    property_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    macro_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pin_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    property_type: Mapped[PropertyType | None] = mapped_column(
        SQLEnum(PropertyType), nullable=True
    )
    plot_extent_sqft: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    built_up_sqft: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    valuation_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    loan_applicant_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    content_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    uploaded_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    listing_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    revisions: Mapped[list["ReportRevision"]] = relationship(back_populates="report")


class ReportRevision(BaseModel):
    __tablename__ = "report_revisions"

    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    revision_number: Mapped[int] = mapped_column(Integer)
    changes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    report: Mapped[Report] = relationship(back_populates="revisions")
```

- [ ] **Step 2: Verify the models import cleanly**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.models.report import Report, ReportRevision; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/report.py
git commit -m "feat: add Report and ReportRevision models with full property schema"
```

---

## Task 4: Listing & ListingReport Models

**Files:**
- Create: `backend/app/models/listing.py`

- [ ] **Step 1: Create the Listing and ListingReport models**

Create `backend/app/models/listing.py`:

```python
import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ListingStatus, PropertyType


class Listing(BaseModel):
    __tablename__ = "listings"

    macro_location: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(255))
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    status: Mapped[ListingStatus] = mapped_column(
        SQLEnum(ListingStatus), default=ListingStatus.DRAFT
    )
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    latest_report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    listing_reports: Mapped[list["ListingReport"]] = relationship(
        back_populates="listing"
    )


class ListingReport(BaseModel):
    __tablename__ = "listing_reports"

    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id"))
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    listing: Mapped[Listing] = relationship(back_populates="listing_reports")

    __table_args__ = (
        UniqueConstraint("report_id", name="uq_listing_report_report_id"),
    )
```

- [ ] **Step 2: Verify the models import cleanly**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.models.listing import Listing, ListingReport; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/listing.py
git commit -m "feat: add Listing and ListingReport models"
```

---

## Task 5: ReportRequest, RequestBroadcast & RequestAcceptance Models

**Files:**
- Create: `backend/app/models/request.py`

- [ ] **Step 1: Create the request models**

Create `backend/app/models/request.py`:

```python
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import (
    BroadcastStatus,
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    VendorRequestStatus,
)


class ReportRequest(BaseModel):
    __tablename__ = "report_requests"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    lender_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("lender_branches.id"), nullable=True
    )
    request_type: Mapped[RequestType] = mapped_column(SQLEnum(RequestType))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    num_reports_needed: Mapped[int] = mapped_column(Integer, default=1)
    property_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    plot_extent_sqft: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    loan_applicant_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    eta_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    vendor_specified_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )
    allow_broadcast_on_reject: Mapped[bool] = mapped_column(Boolean, default=True)
    parent_report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reports.id"), nullable=True
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    lender_status: Mapped[LenderRequestStatus] = mapped_column(
        SQLEnum(LenderRequestStatus), default=LenderRequestStatus.DRAFT
    )
    vendor_status: Mapped[VendorRequestStatus | None] = mapped_column(
        SQLEnum(VendorRequestStatus), nullable=True
    )

    broadcasts: Mapped[list["RequestBroadcast"]] = relationship(
        back_populates="request"
    )
    acceptances: Mapped[list["RequestAcceptance"]] = relationship(
        back_populates="request"
    )


class RequestBroadcast(BaseModel):
    __tablename__ = "request_broadcasts"

    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_requests.id"))
    vendor_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )
    broadcast_round: Mapped[int] = mapped_column(Integer)
    accept_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BroadcastStatus] = mapped_column(
        SQLEnum(BroadcastStatus), default=BroadcastStatus.ACTIVE
    )

    request: Mapped[ReportRequest] = relationship(back_populates="broadcasts")


class RequestAcceptance(BaseModel):
    __tablename__ = "request_acceptances"

    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_requests.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reports.id"), nullable=True
    )

    request: Mapped[ReportRequest] = relationship(back_populates="acceptances")
```

- [ ] **Step 2: Verify the models import cleanly**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.models.request import ReportRequest, RequestBroadcast, RequestAcceptance; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/request.py
git commit -m "feat: add ReportRequest, RequestBroadcast, RequestAcceptance models"
```

---

## Task 6: Billing Models (VendorEarning, LenderPayable, Invoice)

**Files:**
- Create: `backend/app/models/billing.py`

- [ ] **Step 1: Create the billing models**

Create `backend/app/models/billing.py`:

```python
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import EarningType, InvoiceType, PayableType, PaymentStatus


class VendorEarning(BaseModel):
    __tablename__ = "vendor_earnings"

    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("report_requests.id"), nullable=True
    )
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    earning_type: Mapped[EarningType] = mapped_column(SQLEnum(EarningType))
    month: Mapped[str] = mapped_column(String(7))  # "2026-04"


class LenderPayable(BaseModel):
    __tablename__ = "lender_payables"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("report_requests.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    payable_type: Mapped[PayableType] = mapped_column(SQLEnum(PayableType))
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus), default=PaymentStatus.PENDING
    )
    month: Mapped[str] = mapped_column(String(7))  # "2026-04"


class Invoice(BaseModel):
    __tablename__ = "invoices"

    invoice_type: Mapped[InvoiceType] = mapped_column(SQLEnum(InvoiceType))
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus), default=PaymentStatus.PENDING
    )
    month: Mapped[str] = mapped_column(String(7))  # "2026-04"
    generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

- [ ] **Step 2: Verify the models import cleanly**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.models.billing import VendorEarning, LenderPayable, Invoice; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/billing.py
git commit -m "feat: add VendorEarning, LenderPayable, Invoice billing models"
```

---

## Task 7: Register Models & Generate Migration

**Files:**
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Update models/__init__.py to register all new models and enums**

Add these imports after the existing vendor imports in `backend/app/models/__init__.py`:

```python
from app.models.pricing import PricingRule
from app.models.report import Report, ReportRevision
from app.models.listing import Listing, ListingReport
from app.models.request import ReportRequest, RequestBroadcast, RequestAcceptance
from app.models.billing import VendorEarning, LenderPayable, Invoice
```

And add to the existing enum imports in the `from app.models.enums import` block:

```python
    BroadcastStatus,
    EarningType,
    InvoiceType,
    PayableType,
```

And add to the `__all__` list:

```python
    "PricingRule",
    "Report",
    "ReportRevision",
    "Listing",
    "ListingReport",
    "ReportRequest",
    "RequestBroadcast",
    "RequestAcceptance",
    "VendorEarning",
    "LenderPayable",
    "Invoice",
    # New enums
    "EarningType",
    "PayableType",
    "InvoiceType",
    "BroadcastStatus",
```

- [ ] **Step 2: Verify all models import from the package**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.models import PricingRule, Report, ReportRevision, Listing, ListingReport, ReportRequest, RequestBroadcast, RequestAcceptance, VendorEarning, LenderPayable, Invoice; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Generate the Alembic migration**

Run: `docker compose -f docker-compose.local.yml exec backend alembic revision --autogenerate -m "add phase 2 pricing report listing request billing models"`

Expected: A new migration file is created in `backend/alembic/versions/`. Verify it contains `create_table` operations for all 11 tables: `pricing_rules`, `reports`, `report_revisions`, `listings`, `listing_reports`, `report_requests`, `request_broadcasts`, `request_acceptances`, `vendor_earnings`, `lender_payables`, `invoices`.

- [ ] **Step 4: Run the migration**

Run: `docker compose -f docker-compose.local.yml exec backend alembic upgrade head`

Expected: Migration completes successfully with no errors.

- [ ] **Step 5: Verify tables exist in the database**

Run: `docker compose -f docker-compose.local.yml exec postgres psql -U propeval -d propeval -c "\dt" | grep -E "pricing_rules|reports|report_revisions|listings|listing_reports|report_requests|request_broadcasts|request_acceptances|vendor_earnings|lender_payables|invoices"`

Expected: All 11 tables listed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat: register Phase 2 models and generate migration for 11 tables"
```

---

## Task 8: Pricing Schemas

**Files:**
- Create: `backend/app/schemas/pricing.py`

- [ ] **Step 1: Create pricing schemas**

Create `backend/app/schemas/pricing.py`:

```python
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class PricingRuleCreate(BaseModel):
    lender_id: UUID
    report_category: str
    city: str
    area: str | None = None
    property_type: str
    new_request_price: Decimal
    listing_download_price: Decimal
    update_additional_price: Decimal
    nearby_additional_price: Decimal


class PricingRuleUpdate(BaseModel):
    city: str | None = None
    area: str | None = None
    property_type: str | None = None
    report_category: str | None = None
    new_request_price: Decimal | None = None
    listing_download_price: Decimal | None = None
    update_additional_price: Decimal | None = None
    nearby_additional_price: Decimal | None = None


class PricingRuleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    report_category: str
    city: str
    area: str | None = None
    property_type: str
    new_request_price: Decimal
    listing_download_price: Decimal
    update_additional_price: Decimal
    nearby_additional_price: Decimal
    is_active: bool


class PriceCalculationRequest(BaseModel):
    lender_id: UUID
    report_category: str
    city: str
    area: str | None = None
    property_type: str
    request_type: str


class PriceCalculationResponse(BaseModel):
    amount: Decimal
    rule_id: UUID
    matched_area: str | None = None
```

- [ ] **Step 2: Verify import**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.schemas.pricing import PricingRuleCreate, PricingRuleResponse, PriceCalculationRequest; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/pricing.py
git commit -m "feat: add pricing Pydantic schemas"
```

---

## Task 9: Pricing Service — Write Tests First

**Files:**
- Create: `backend/tests/services/__init__.py`
- Create: `backend/tests/services/test_pricing_service.py`

- [ ] **Step 1: Create the test directory and init file**

Create empty `backend/tests/services/__init__.py`.

- [ ] **Step 2: Write pricing service tests**

Create `backend/tests/services/test_pricing_service.py`:

```python
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PropertyType, ReportCategory, RequestType, UserType
from app.models.lender import Lender
from app.models.user import Organization


async def _create_test_lender(db: AsyncSession) -> Lender:
    """Helper to create a lender for pricing tests."""
    org = Organization(name="Test Lender Org", type=UserType.LENDER, city="Mumbai")
    db.add(org)
    await db.flush()
    lender = Lender(organization_id=org.id, name="Test Lender", city="Mumbai")
    db.add(lender)
    await db.flush()
    return lender


@pytest.mark.asyncio
async def test_create_pricing_rule(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule

    lender = await _create_test_lender(db_session)
    rule = await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    assert rule.id is not None
    assert rule.lender_id == lender.id
    assert rule.new_request_price == Decimal("2500.00")
    assert rule.is_active is True


@pytest.mark.asyncio
async def test_list_pricing_rules(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, list_pricing_rules

    lender = await _create_test_lender(db_session)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    rules = await list_pricing_rules(db_session, lender_id=lender.id)
    assert len(rules) == 1
    assert rules[0].city == "Mumbai"


@pytest.mark.asyncio
async def test_get_price_exact_match(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, get_price

    lender = await _create_test_lender(db_session)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        new_request_price=Decimal("3000.00"),
        listing_download_price=Decimal("2000.00"),
        update_additional_price=Decimal("1500.00"),
        nearby_additional_price=Decimal("1500.00"),
    )
    result = await get_price(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        request_type="NEW",
    )
    assert result.amount == Decimal("3000.00")
    assert result.matched_area == "Andheri"


@pytest.mark.asyncio
async def test_get_price_fallback_to_city(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, get_price

    lender = await _create_test_lender(db_session)
    # Create city-level rule (area=None)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    # Query with area that has no specific rule -> should fall back
    result = await get_price(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area="Bandra",
        property_type="RESIDENTIAL",
        request_type="NEW",
    )
    assert result.amount == Decimal("2500.00")
    assert result.matched_area is None


@pytest.mark.asyncio
async def test_get_price_not_found(db_session: AsyncSession):
    from app.services.pricing_service import get_price, PricingNotFoundError

    lender = await _create_test_lender(db_session)
    with pytest.raises(PricingNotFoundError):
        await get_price(
            db_session,
            lender_id=lender.id,
            report_category="VALUATION",
            city="Delhi",
            area=None,
            property_type="RESIDENTIAL",
            request_type="NEW",
        )


@pytest.mark.asyncio
async def test_get_price_returns_correct_variant(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, get_price

    lender = await _create_test_lender(db_session)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="LEGAL",
        city="Mumbai",
        area=None,
        property_type="COMMERCIAL",
        new_request_price=Decimal("5000.00"),
        listing_download_price=Decimal("3000.00"),
        update_additional_price=Decimal("2000.00"),
        nearby_additional_price=Decimal("1500.00"),
    )
    # Test each variant
    new = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "NEW")
    assert new.amount == Decimal("5000.00")

    download = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "LISTING_DOWNLOAD")
    assert download.amount == Decimal("3000.00")

    update = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "UPDATE")
    assert update.amount == Decimal("2000.00")

    nearby = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "NEARBY")
    assert nearby.amount == Decimal("1500.00")


@pytest.mark.asyncio
async def test_delete_pricing_rule_soft_deletes(db_session: AsyncSession):
    from app.services.pricing_service import (
        create_pricing_rule,
        delete_pricing_rule,
        list_pricing_rules,
    )

    lender = await _create_test_lender(db_session)
    rule = await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    await delete_pricing_rule(db_session, rule.id)
    rules = await list_pricing_rules(db_session, lender_id=lender.id)
    assert len(rules) == 0  # soft-deleted rules are excluded
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_pricing_service.py -v`

Expected: All tests FAIL with `ModuleNotFoundError: No module named 'app.services.pricing_service'`

- [ ] **Step 4: Commit**

```bash
git add backend/tests/services/
git commit -m "test: add pricing service unit tests (red phase)"
```

---

## Task 10: Pricing Service — Implementation

**Files:**
- Create: `backend/app/services/pricing_service.py`

- [ ] **Step 1: Implement the pricing service**

Create `backend/app/services/pricing_service.py`:

```python
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PropertyType, ReportCategory
from app.models.pricing import PricingRule


class PricingNotFoundError(Exception):
    pass


@dataclass
class PriceResult:
    amount: Decimal
    rule_id: UUID
    matched_area: str | None


async def create_pricing_rule(
    db: AsyncSession,
    *,
    lender_id: UUID,
    report_category: str,
    city: str,
    area: str | None,
    property_type: str,
    new_request_price: Decimal,
    listing_download_price: Decimal,
    update_additional_price: Decimal,
    nearby_additional_price: Decimal,
) -> PricingRule:
    rule = PricingRule(
        lender_id=lender_id,
        report_category=ReportCategory(report_category),
        city=city,
        area=area,
        property_type=PropertyType(property_type),
        new_request_price=new_request_price,
        listing_download_price=listing_download_price,
        update_additional_price=update_additional_price,
        nearby_additional_price=nearby_additional_price,
    )
    db.add(rule)
    await db.flush()
    return rule


async def list_pricing_rules(
    db: AsyncSession,
    *,
    lender_id: UUID,
    city: str | None = None,
    report_category: str | None = None,
    property_type: str | None = None,
) -> list[PricingRule]:
    stmt = select(PricingRule).where(
        PricingRule.lender_id == lender_id,
        PricingRule.is_active == True,
    )
    if city:
        stmt = stmt.where(PricingRule.city == city)
    if report_category:
        stmt = stmt.where(PricingRule.report_category == ReportCategory(report_category))
    if property_type:
        stmt = stmt.where(PricingRule.property_type == PropertyType(property_type))
    stmt = stmt.order_by(PricingRule.city, PricingRule.area, PricingRule.property_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_pricing_rule(db: AsyncSession, rule_id: UUID) -> PricingRule | None:
    result = await db.execute(
        select(PricingRule).where(PricingRule.id == rule_id, PricingRule.is_active == True)
    )
    return result.scalar_one_or_none()


async def update_pricing_rule(
    db: AsyncSession, rule: PricingRule, **kwargs
) -> PricingRule:
    for key, value in kwargs.items():
        if value is not None and hasattr(rule, key):
            if key == "report_category":
                value = ReportCategory(value)
            elif key == "property_type":
                value = PropertyType(value)
            setattr(rule, key, value)
    await db.flush()
    return rule


async def delete_pricing_rule(db: AsyncSession, rule_id: UUID) -> None:
    rule = await get_pricing_rule(db, rule_id)
    if rule:
        rule.is_active = False
        await db.flush()


_VARIANT_MAP = {
    "NEW": "new_request_price",
    "LISTING_DOWNLOAD": "listing_download_price",
    "UPDATE": "update_additional_price",
    "NEARBY": "nearby_additional_price",
}


async def get_price(
    db: AsyncSession,
    lender_id: UUID,
    report_category: str,
    city: str,
    area: str | None,
    property_type: str,
    request_type: str,
) -> PriceResult:
    price_column = _VARIANT_MAP.get(request_type)
    if not price_column:
        raise ValueError(f"Unknown request_type: {request_type}")

    cat = ReportCategory(report_category)
    pt = PropertyType(property_type)

    # Try exact match (with area) first
    if area is not None:
        result = await db.execute(
            select(PricingRule).where(
                PricingRule.lender_id == lender_id,
                PricingRule.report_category == cat,
                PricingRule.city == city,
                PricingRule.area == area,
                PricingRule.property_type == pt,
                PricingRule.is_active == True,
            )
        )
        rule = result.scalar_one_or_none()
        if rule:
            return PriceResult(
                amount=getattr(rule, price_column),
                rule_id=rule.id,
                matched_area=rule.area,
            )

    # Fallback: city-level rule (area IS NULL)
    result = await db.execute(
        select(PricingRule).where(
            PricingRule.lender_id == lender_id,
            PricingRule.report_category == cat,
            PricingRule.city == city,
            PricingRule.area.is_(None),
            PricingRule.property_type == pt,
            PricingRule.is_active == True,
        )
    )
    rule = result.scalar_one_or_none()
    if rule:
        return PriceResult(
            amount=getattr(rule, price_column),
            rule_id=rule.id,
            matched_area=None,
        )

    raise PricingNotFoundError(
        f"No pricing rule found for lender={lender_id}, "
        f"category={report_category}, city={city}, area={area}, "
        f"property_type={property_type}"
    )
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `docker compose -f docker-compose.local.yml exec backend python -m pytest tests/services/test_pricing_service.py -v`

Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/pricing_service.py
git commit -m "feat: implement pricing service with area fallback lookup"
```

---

## Task 11: Admin Pricing API — Write Tests First

**Files:**
- Create: `backend/tests/api/test_pricing.py`

- [ ] **Step 1: Write admin pricing API tests**

Create `backend/tests/api/test_pricing.py`:

```python
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
    # Admin org + user
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
    admin_token = create_access_token({"sub": str(admin.id)})

    # Lender org + lender
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
    # Create a rule first
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
    # Verify it's gone from the list
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
    # Create a lender user instead of admin
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
    token = create_access_token({"sub": str(lender_user.id)})
    response = await client.get(
        "/api/admin/pricing/rules?lender_id=00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose -f docker-compose.local.yml exec backend python -m pytest tests/api/test_pricing.py -v`

Expected: Tests FAIL (no `/api/admin/pricing` routes exist yet).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/api/test_pricing.py
git commit -m "test: add admin pricing API integration tests (red phase)"
```

---

## Task 12: Admin Pricing API — Implementation

**Files:**
- Create: `backend/app/api/admin/pricing.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the admin pricing router**

Create `backend/app/api/admin/pricing.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.schemas.pricing import (
    PriceCalculationResponse,
    PricingRuleCreate,
    PricingRuleResponse,
    PricingRuleUpdate,
)
from app.services import pricing_service
from app.services.pricing_service import PricingNotFoundError

router = APIRouter(prefix="/api/admin/pricing", tags=["admin-pricing"])


@router.get("/rules", response_model=list[PricingRuleResponse])
async def list_rules(
    lender_id: UUID = Query(...),
    city: str | None = Query(None),
    report_category: str | None = Query(None),
    property_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await pricing_service.list_pricing_rules(
        db,
        lender_id=lender_id,
        city=city,
        report_category=report_category,
        property_type=property_type,
    )


@router.post(
    "/rules",
    response_model=PricingRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    payload: PricingRuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await pricing_service.create_pricing_rule(
        db,
        lender_id=payload.lender_id,
        report_category=payload.report_category,
        city=payload.city,
        area=payload.area,
        property_type=payload.property_type,
        new_request_price=payload.new_request_price,
        listing_download_price=payload.listing_download_price,
        update_additional_price=payload.update_additional_price,
        nearby_additional_price=payload.nearby_additional_price,
    )


@router.put("/rules/{rule_id}", response_model=PricingRuleResponse)
async def update_rule(
    rule_id: UUID,
    payload: PricingRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    rule = await pricing_service.get_pricing_rule(db, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found"
        )
    return await pricing_service.update_pricing_rule(
        db, rule, **payload.model_dump(exclude_unset=True)
    )


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    rule = await pricing_service.get_pricing_rule(db, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found"
        )
    await pricing_service.delete_pricing_rule(db, rule_id)
    return {"detail": "Pricing rule deleted"}


@router.get("/calculate", response_model=PriceCalculationResponse)
async def calculate_price(
    lender_id: UUID = Query(...),
    report_category: str = Query(...),
    city: str = Query(...),
    area: str | None = Query(None),
    property_type: str = Query(...),
    request_type: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    try:
        result = await pricing_service.get_price(
            db,
            lender_id=lender_id,
            report_category=report_category,
            city=city,
            area=area,
            property_type=property_type,
            request_type=request_type,
        )
    except PricingNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )
    return PriceCalculationResponse(
        amount=result.amount,
        rule_id=result.rule_id,
        matched_area=result.matched_area,
    )
```

- [ ] **Step 2: Register the router in main.py**

Add to `backend/app/main.py` after the existing imports:

```python
from app.api.admin.pricing import router as admin_pricing_router
```

And add before the closing of the file:

```python
app.include_router(admin_pricing_router)
```

- [ ] **Step 3: Run the API tests to verify they pass**

Run: `docker compose -f docker-compose.local.yml exec backend python -m pytest tests/api/test_pricing.py -v`

Expected: All 6 tests PASS.

- [ ] **Step 4: Run ALL tests to check for regressions**

Run: `docker compose -f docker-compose.local.yml exec backend python -m pytest -v`

Expected: All tests PASS (health + pricing service + pricing API).

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/admin/pricing.py backend/app/main.py
git commit -m "feat: add admin pricing API (5 endpoints) with role-based access"
```

---

## Task 13: Remaining Schemas (Report, Listing, Request, Billing)

**Files:**
- Create: `backend/app/schemas/report.py`
- Create: `backend/app/schemas/listing.py`
- Create: `backend/app/schemas/request.py`
- Create: `backend/app/schemas/billing.py`

- [ ] **Step 1: Create report schemas**

Create `backend/app/schemas/report.py`:

```python
from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReportCreate(BaseModel):
    vendor_id: UUID
    report_category: str
    property_address: str | None = None
    macro_location: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    plot_extent_sqft: Decimal | None = None
    built_up_sqft: Decimal | None = None
    valuation_amount: Decimal | None = None
    loan_applicant_name: str | None = None
    report_date: date | None = None
    uploaded_file_path: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class ReportResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    report_category: str
    status: str
    property_address: str | None = None
    macro_location: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    plot_extent_sqft: Decimal | None = None
    built_up_sqft: Decimal | None = None
    valuation_amount: Decimal | None = None
    loan_applicant_name: str | None = None
    report_date: date | None = None
    expiry_date: date | None = None
    uploaded_file_path: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    listing_approved: bool
    is_active: bool


class ReportBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_category: str
    city: str | None = None
    macro_location: str | None = None
    property_type: str | None = None
    status: str
    report_date: date | None = None
```

- [ ] **Step 2: Create listing schemas**

Create `backend/app/schemas/listing.py`:

```python
from datetime import date
from uuid import UUID

from pydantic import BaseModel


class ListingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    macro_location: str
    city: str
    property_type: str
    status: str
    report_count: int
    latest_report_date: date | None = None
    is_active: bool


class ListingBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    macro_location: str
    city: str
    property_type: str
    report_count: int
    latest_report_date: date | None = None
```

- [ ] **Step 3: Create request schemas**

Create `backend/app/schemas/request.py`:

```python
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReportRequestCreate(BaseModel):
    lender_id: UUID
    request_type: str
    report_category: str
    property_address: str | None = None
    property_type: str
    plot_extent_sqft: Decimal | None = None
    loan_applicant_name: str | None = None
    city: str | None = None
    area: str | None = None
    eta_days: int | None = None
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool = True
    parent_report_id: UUID | None = None
    comments: str | None = None


class ReportRequestResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    lender_user_id: UUID
    branch_id: UUID | None = None
    request_type: str
    report_category: str
    num_reports_needed: int
    property_address: str | None = None
    property_type: str
    plot_extent_sqft: Decimal | None = None
    loan_applicant_name: str | None = None
    city: str | None = None
    area: str | None = None
    eta_days: int | None = None
    price: Decimal | None = None
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool
    parent_report_id: UUID | None = None
    comments: str | None = None
    lender_status: str
    vendor_status: str | None = None
```

- [ ] **Step 4: Create billing schemas**

Create `backend/app/schemas/billing.py`:

```python
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class VendorEarningResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    report_id: UUID
    request_id: UUID | None = None
    lender_id: UUID
    amount: Decimal
    earning_type: str
    month: str


class LenderPayableResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    report_id: UUID
    request_id: UUID | None = None
    amount: Decimal
    payable_type: str
    status: str
    month: str


class InvoiceResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    invoice_type: str
    organization_id: UUID
    amount: Decimal
    status: str
    month: str
    generated_at: datetime | None = None
```

- [ ] **Step 5: Verify all schemas import cleanly**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "from app.schemas.report import ReportCreate, ReportResponse, ReportBrief; from app.schemas.listing import ListingResponse, ListingBrief; from app.schemas.request import ReportRequestCreate, ReportRequestResponse; from app.schemas.billing import VendorEarningResponse, LenderPayableResponse, InvoiceResponse; print('OK')"`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/report.py backend/app/schemas/listing.py backend/app/schemas/request.py backend/app/schemas/billing.py
git commit -m "feat: add Pydantic schemas for report, listing, request, billing"
```

---

## Task 14: Seed Pricing Data

**Files:**
- Modify: `backend/scripts/seed.py`

- [ ] **Step 1: Add pricing seed data to seed.py**

Add the following after the vendor user creation block (before `print("\nSeed complete.")`), in `backend/scripts/seed.py`:

First add the import at the top of the file:

```python
from app.services import lender_service, user_service, vendor_service, pricing_service
```

Then add the pricing seed block:

```python
        # ── Sample pricing rules for ABCL Bank ──────────────────────────────
        from decimal import Decimal

        pricing_configs = [
            {
                "report_category": "VALUATION",
                "city": "Bengaluru",
                "area": None,
                "property_type": "RESIDENTIAL",
                "new_request_price": Decimal("2500.00"),
                "listing_download_price": Decimal("1500.00"),
                "update_additional_price": Decimal("1000.00"),
                "nearby_additional_price": Decimal("1000.00"),
            },
            {
                "report_category": "VALUATION",
                "city": "Bengaluru",
                "area": None,
                "property_type": "COMMERCIAL",
                "new_request_price": Decimal("5000.00"),
                "listing_download_price": Decimal("3000.00"),
                "update_additional_price": Decimal("2000.00"),
                "nearby_additional_price": Decimal("2000.00"),
            },
            {
                "report_category": "LEGAL",
                "city": "Bengaluru",
                "area": None,
                "property_type": "RESIDENTIAL",
                "new_request_price": Decimal("2000.00"),
                "listing_download_price": Decimal("1200.00"),
                "update_additional_price": Decimal("800.00"),
                "nearby_additional_price": Decimal("800.00"),
            },
            {
                "report_category": "VALUATION",
                "city": "Bengaluru",
                "area": "Koramangala",
                "property_type": "RESIDENTIAL",
                "new_request_price": Decimal("2800.00"),
                "listing_download_price": Decimal("1800.00"),
                "update_additional_price": Decimal("1200.00"),
                "nearby_additional_price": Decimal("1200.00"),
            },
        ]
        for cfg in pricing_configs:
            rule = await pricing_service.create_pricing_rule(
                db, lender_id=lender.id, **cfg
            )
            area_label = cfg["area"] or "city-wide"
            print(
                f"Created pricing rule: {cfg['city']}/{area_label} "
                f"{cfg['property_type']} {cfg['report_category']} "
                f"(new={cfg['new_request_price']})"
            )
```

- [ ] **Step 2: Verify the seed script syntax is valid**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "import scripts.seed; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/seed.py
git commit -m "feat: add sample pricing rules to seed script"
```

---

## Task 15: Frontend Types

**Files:**
- Create: `frontend/src/types/pricing.ts`

- [ ] **Step 1: Create pricing TypeScript types**

Create `frontend/src/types/pricing.ts`:

```typescript
export interface PricingRule {
  id: string;
  lender_id: string;
  report_category: string;
  city: string;
  area: string | null;
  property_type: string;
  new_request_price: string;
  listing_download_price: string;
  update_additional_price: string;
  nearby_additional_price: string;
  is_active: boolean;
}

export interface PricingRuleCreate {
  lender_id: string;
  report_category: string;
  city: string;
  area?: string | null;
  property_type: string;
  new_request_price: string;
  listing_download_price: string;
  update_additional_price: string;
  nearby_additional_price: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/pricing.ts
git commit -m "feat: add PricingRule TypeScript types"
```

---

## Task 16: Admin Pricing Page

**Files:**
- Create: `frontend/src/app/admin/pricing/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Create the admin pricing page**

Create `frontend/src/app/admin/pricing/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Lender } from "@/types/user";
import type { PricingRule, PricingRuleCreate } from "@/types/pricing";

const REPORT_CATEGORIES = ["VALUATION", "LEGAL"];
const PROPERTY_TYPES = ["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "AGRICULTURAL"];

function emptyForm(lenderId: string): PricingRuleCreate {
  return {
    lender_id: lenderId,
    report_category: "VALUATION",
    city: "",
    area: null,
    property_type: "RESIDENTIAL",
    new_request_price: "",
    listing_download_price: "",
    update_additional_price: "",
    nearby_additional_price: "",
  };
}

export default function AdminPricingPage() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [selectedLender, setSelectedLender] = useState<string>("");
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingRuleCreate>(emptyForm(""));
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterCity, setFilterCity] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPropertyType, setFilterPropertyType] = useState("");

  useEffect(() => {
    api.get<Lender[]>("/api/admin/lenders").then(setLenders).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedLender) {
      setRules([]);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ lender_id: selectedLender });
    if (filterCity) params.set("city", filterCity);
    if (filterCategory) params.set("report_category", filterCategory);
    if (filterPropertyType) params.set("property_type", filterPropertyType);
    api
      .get<PricingRule[]>(`/api/admin/pricing/rules?${params}`)
      .then(setRules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedLender, filterCity, filterCategory, filterPropertyType]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm(selectedLender));
    setShowForm(true);
  }

  function openEdit(rule: PricingRule) {
    setEditingId(rule.id);
    setForm({
      lender_id: rule.lender_id,
      report_category: rule.report_category,
      city: rule.city,
      area: rule.area,
      property_type: rule.property_type,
      new_request_price: rule.new_request_price,
      listing_download_price: rule.listing_download_price,
      update_additional_price: rule.update_additional_price,
      nearby_additional_price: rule.nearby_additional_price,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, area: form.area || null };
      if (editingId) {
        const updated = await api.put<PricingRule>(
          `/api/admin/pricing/rules/${editingId}`,
          payload
        );
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await api.post<PricingRule>(
          "/api/admin/pricing/rules",
          payload
        );
        setRules((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("Delete this pricing rule?")) return;
    try {
      await api.delete(`/api/admin/pricing/rules/${ruleId}`);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Pricing Rules</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure pricing per lender, city, property type, and report category
        </p>
      </div>

      {/* Lender selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedLender}
          onChange={(e) => setSelectedLender(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a lender</option>
          {lenders.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {selectedLender && (
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            Add Rule
          </button>
        )}
      </div>

      {/* Filters */}
      {selectedLender && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            placeholder="Filter by city"
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterPropertyType}
            onChange={(e) => setFilterPropertyType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Property Types</option>
            {PROPERTY_TYPES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-700">
            {editingId ? "Edit Pricing Rule" : "New Pricing Rule"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
              <input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mumbai"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Area</label>
              <input
                value={form.area || ""}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank for city-wide pricing"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Property Type *</label>
              <select
                required
                value={form.property_type}
                onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PROPERTY_TYPES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Report Category *</label>
              <select
                required
                value={form.report_category}
                onChange={(e) => setForm({ ...form, report_category: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New Request Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.new_request_price}
                onChange={(e) => setForm({ ...form, new_request_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Download Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.listing_download_price}
                onChange={(e) => setForm({ ...form, listing_download_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Update Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.update_additional_price}
                onChange={(e) => setForm({ ...form, update_additional_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nearby Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.nearby_additional_price}
                onChange={(e) => setForm({ ...form, nearby_additional_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Update Rule" : "Save Rule"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Desktop/Tablet: Table */}
      {selectedLender && (
        <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">City</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Area</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">New</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Download</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Update</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Nearby</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td>
                  </tr>
                )}
                {!loading && rules.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      No pricing rules. Add one above.
                    </td>
                  </tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{r.city}</td>
                    <td className="px-4 py-3 text-gray-600">{r.area || "All"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.property_type}</td>
                    <td className="px-4 py-3 text-gray-600">{r.report_category}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.new_request_price}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.listing_download_price}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.update_additional_price}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.nearby_additional_price}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile: Card list */}
      {selectedLender && (
        <div className="md:hidden space-y-3">
          {loading && <p className="text-center text-gray-400 py-8">Loading...</p>}
          {!loading && rules.length === 0 && (
            <p className="text-center text-gray-400 py-8">No pricing rules. Add one above.</p>
          )}
          {rules.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{r.city} {r.area ? `/ ${r.area}` : ""}</div>
                  <div className="text-sm text-gray-500">{r.property_type} - {r.report_category}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(r)} className="text-blue-600 text-sm hover:underline">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 text-sm hover:underline">Delete</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">New:</span> <span className="font-medium">{r.new_request_price}</span></div>
                <div><span className="text-gray-500">Download:</span> <span className="font-medium">{r.listing_download_price}</span></div>
                <div><span className="text-gray-500">Update:</span> <span className="font-medium">{r.update_additional_price}</span></div>
                <div><span className="text-gray-500">Nearby:</span> <span className="font-medium">{r.nearby_additional_price}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Pricing nav link to admin layout**

In `frontend/src/app/admin/layout.tsx`, add a Pricing link in BOTH the desktop sidebar nav and the mobile drawer nav. Add this line after the Vendors link in each nav:

```tsx
<a href="/admin/pricing" className="block px-2 py-3 rounded hover:bg-gray-100">Pricing</a>
```

There are two `<nav>` blocks — add the link to both.

- [ ] **Step 3: Verify the frontend builds**

Run: `docker compose -f docker-compose.local.yml exec frontend npm run build`

Expected: Build completes successfully with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/pricing/page.tsx frontend/src/app/admin/layout.tsx
git commit -m "feat: add admin pricing management page with responsive table/card layout"
```

---

## Task 17: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `docker compose -f docker-compose.local.yml exec backend python -m pytest -v`

Expected: All tests pass (health, pricing service, pricing API).

- [ ] **Step 2: Run the seed script on a fresh database**

Run: `docker compose -f docker-compose.local.yml exec backend alembic downgrade base && docker compose -f docker-compose.local.yml exec backend alembic upgrade head && docker compose -f docker-compose.local.yml exec backend python -m scripts.seed`

Expected: Seed completes with pricing rules printed.

- [ ] **Step 3: Verify the pricing API manually**

Run: `docker compose -f docker-compose.local.yml exec backend python -c "
import asyncio
from app.core.database import get_async_session_context
from app.services.pricing_service import list_pricing_rules
from app.models.lender import Lender
from sqlalchemy import select

async def check():
    async with get_async_session_context() as db:
        result = await db.execute(select(Lender).limit(1))
        lender = result.scalar_one()
        rules = await list_pricing_rules(db, lender_id=lender.id)
        print(f'Found {len(rules)} pricing rules for {lender.name}')
        for r in rules:
            print(f'  {r.city}/{r.area or \"city-wide\"} {r.property_type.value} {r.report_category.value} new={r.new_request_price}')

asyncio.run(check())
"`

Expected: 4 pricing rules listed for ABCL Bank.

- [ ] **Step 4: Verify the frontend loads the pricing page**

Start the local environment and navigate to `http://localhost:3020/admin/pricing`. Verify:
- Lender dropdown loads with ABCL Bank
- Selecting the lender shows the 4 pricing rules
- Add/Edit/Delete operations work

- [ ] **Step 5: Commit any remaining changes and run lint**

Run: `docker compose -f docker-compose.local.yml exec backend python -m pytest -v && docker compose -f docker-compose.local.yml exec frontend npm run build`

Expected: All tests pass, frontend builds cleanly.
