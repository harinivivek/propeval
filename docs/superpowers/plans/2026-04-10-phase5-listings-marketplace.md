# Phase 5: Listings Marketplace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a listings marketplace where vendors list published reports and lenders browse, filter, and purchase individual reports with instant access.

**Architecture:** Materialized Listing entities grouped by pin_code + property_type. Vendors list/delist reports via a toggle + dedicated page. Lenders browse listings with PII-redacted previews, purchase individual reports, and get permanent download access. ReportPurchase model tracks access; billing entries created on purchase.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-04-10-phase5-listings-marketplace-design.md`

---

## File Structure

### Backend — Create

| File | Responsibility |
|------|---------------|
| `backend/app/models/purchase.py` | ReportPurchase model |
| `backend/app/schemas/listing.py` | Listing + redacted report preview schemas |
| `backend/app/schemas/purchase.py` | Purchase request/response schemas |
| `backend/app/services/listing_service.py` | All listing logic: list/delist, browse, purchase, redaction |
| `backend/app/api/vendor/listings.py` | Vendor listing endpoints (4) |
| `backend/app/api/lender/listings.py` | Lender listing endpoints (5) |

### Backend — Modify

| File | Change |
|------|--------|
| `backend/app/models/listing.py` | Add `pin_code`, `vendor_count` fields + unique constraint |
| `backend/app/models/__init__.py` | Register `ReportPurchase` |
| `backend/app/services/billing_service.py` | Add `create_listing_purchase_entries()` |
| `backend/app/main.py` | Register 2 new routers |

### Frontend — Create

| File | Responsibility |
|------|---------------|
| `frontend/src/types/listing.ts` | Listing, purchase, redacted report types |
| `frontend/src/app/vendor/listings/page.tsx` | Vendor listings management page |
| `frontend/src/app/vendor/listings/_components/listing-group.tsx` | Expandable listing group with report rows |
| `frontend/src/app/vendor/listings/_components/listable-reports.tsx` | Unlisted reports section |
| `frontend/src/app/lender/listings/page.tsx` | Listings browse page |
| `frontend/src/app/lender/listings/_components/listing-card.tsx` | Listing card component |
| `frontend/src/app/lender/listings/[id]/page.tsx` | Listing detail page |
| `frontend/src/app/lender/listings/[id]/_components/report-preview-card.tsx` | Redacted report preview card |
| `frontend/src/app/lender/listings/[id]/_components/purchase-dialog.tsx` | Purchase confirmation dialog |
| `frontend/src/app/lender/listings/purchases/page.tsx` | Purchased reports page |

### Frontend — Modify

| File | Change |
|------|--------|
| `frontend/src/app/lender/layout.tsx` | Add "Listings" and "Purchased Reports" nav links |
| `frontend/src/app/vendor/layout.tsx` | Add "My Listings" nav link |

---

## Task 1: Data Model — Listing Updates + ReportPurchase

**Files:**
- Modify: `backend/app/models/listing.py`
- Create: `backend/app/models/purchase.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Add `pin_code` and `vendor_count` to Listing model**

In `backend/app/models/listing.py`, add two new fields and a unique constraint:

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
    pin_code: Mapped[str] = mapped_column(String(10))
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    status: Mapped[ListingStatus] = mapped_column(
        SQLEnum(ListingStatus), default=ListingStatus.DRAFT
    )
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    vendor_count: Mapped[int] = mapped_column(Integer, default=0)
    latest_report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    listing_reports: Mapped[list["ListingReport"]] = relationship(
        back_populates="listing"
    )

    __table_args__ = (
        UniqueConstraint("pin_code", "property_type", name="uq_listing_pin_code_property_type"),
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

- [ ] **Step 2: Create ReportPurchase model**

Create `backend/app/models/purchase.py`:

```python
import uuid
from decimal import Decimal

from sqlalchemy import (
    ForeignKey,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ReportPurchase(BaseModel):
    __tablename__ = "report_purchases"

    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id"))
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    purchased_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    __table_args__ = (
        UniqueConstraint("report_id", "lender_id", name="uq_purchase_report_lender"),
    )
```

- [ ] **Step 3: Register ReportPurchase in models `__init__.py`**

In `backend/app/models/__init__.py`, add the import and `__all__` entry:

```python
# Add import after the listing import line:
from app.models.purchase import ReportPurchase

# Add to __all__ list after "ListingReport":
    "ReportPurchase",
```

- [ ] **Step 4: Generate and run Alembic migration**

```bash
# Inside backend container:
docker compose -f docker-compose.local.yml exec backend alembic revision --autogenerate -m "phase5 add listing pin_code vendor_count and report_purchases table"

# Copy migration to host:
docker compose -f docker-compose.local.yml exec backend ls -t alembic/versions/ | head -1
# Then:
docker cp propeval-backend-1:/app/alembic/versions/<migration_file>.py backend/alembic/versions/

# Run migration:
docker compose -f docker-compose.local.yml exec backend alembic upgrade head
```

Verify the migration created:
- Added `pin_code` (varchar(10)) and `vendor_count` (integer) columns to `listings`
- Added unique constraint `uq_listing_pin_code_property_type` on `listings`
- Created `report_purchases` table with correct columns and unique constraint

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/listing.py backend/app/models/purchase.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat(phase5): add ReportPurchase model, listing pin_code + vendor_count fields"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/listing.py`
- Create: `backend/app/schemas/purchase.py`

- [ ] **Step 1: Create listing schemas**

Create `backend/app/schemas/listing.py`:

```python
from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ListingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    macro_location: str
    city: str
    pin_code: str
    property_type: str
    status: str
    report_count: int
    vendor_count: int
    latest_report_date: date | None = None


class ListingBrowseResponse(BaseModel):
    listings: list[ListingResponse]
    total: int
    page: int
    page_size: int


class RedactedReportPreview(BaseModel):
    id: UUID
    report_category: str
    locality: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    plot_extent_sqft: int | None = None
    built_up_sqft: int | None = None
    report_date: date | None = None
    latitude: float | None = None
    longitude: float | None = None
    content_preview: dict | None = None
    is_purchased: bool = False


class ListingDetailResponse(BaseModel):
    listing: ListingResponse
    reports: list[RedactedReportPreview]


class VendorListingReportItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_category: str
    property_address: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    report_date: date | None = None
    status: str
    listing_approved: bool


class VendorListingGroup(BaseModel):
    listing: ListingResponse
    reports: list[VendorListingReportItem]


class VendorListingsResponse(BaseModel):
    groups: list[VendorListingGroup]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 2: Create purchase schemas**

Create `backend/app/schemas/purchase.py`:

```python
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.report import ReportResponse


class PurchaseResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_id: UUID
    listing_id: UUID
    lender_id: UUID
    price: Decimal
    created_at: datetime


class PurchasedReportItem(BaseModel):
    purchase: PurchaseResponse
    report: ReportResponse


class PurchasedReportsResponse(BaseModel):
    items: list[PurchasedReportItem]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/listing.py backend/app/schemas/purchase.py
git commit -m "feat(phase5): add listing and purchase Pydantic schemas"
```

---

## Task 3: Billing Service Extension

**Files:**
- Modify: `backend/app/services/billing_service.py`

- [ ] **Step 1: Add `create_listing_purchase_entries` function**

Add to `backend/app/services/billing_service.py` after the existing `create_billing_entries` function:

```python
async def create_listing_purchase_entries(
    db: AsyncSession,
    *,
    report_id: UUID,
    vendor_id: UUID,
    lender_id: UUID,
    amount: Decimal,
) -> tuple[VendorEarning, LenderPayable]:
    """Create VendorEarning + LenderPayable on listing report purchase."""
    month = datetime.utcnow().strftime("%Y-%m")

    earning = VendorEarning(
        vendor_id=vendor_id,
        report_id=report_id,
        request_id=None,
        lender_id=lender_id,
        amount=amount,
        earning_type=EarningType.LISTING_DOWNLOAD,
        month=month,
    )
    db.add(earning)

    payable = LenderPayable(
        lender_id=lender_id,
        report_id=report_id,
        request_id=None,
        amount=amount,
        payable_type=PayableType.LISTING_DOWNLOAD,
        status=PaymentStatus.PENDING,
        month=month,
    )
    db.add(payable)

    await db.flush()
    return earning, payable
```

Also add the missing import at the top of the file:

```python
from decimal import Decimal
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/billing_service.py
git commit -m "feat(phase5): add listing purchase billing entries function"
```

---

## Task 4: Listing Service — Redaction + List/Delist

**Files:**
- Create: `backend/app/services/listing_service.py`

- [ ] **Step 1: Create listing service with PII redaction and list/delist logic**

Create `backend/app/services/listing_service.py`:

```python
from datetime import date, datetime
from decimal import Decimal
from math import ceil, floor
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    EarningType,
    ListingStatus,
    PayableType,
    PropertyType,
    ReportCategory,
    ReportStatus,
)
from app.models.listing import Listing, ListingReport
from app.models.purchase import ReportPurchase
from app.models.report import Report
from app.schemas.listing import (
    ListingBrowseResponse,
    ListingDetailResponse,
    ListingResponse,
    RedactedReportPreview,
    VendorListingGroup,
    VendorListingReportItem,
    VendorListingsResponse,
)
from app.schemas.purchase import (
    PurchasedReportItem,
    PurchasedReportsResponse,
    PurchaseResponse,
)
from app.schemas.report import ReportResponse
from app.services.billing_service import create_listing_purchase_entries
from app.services.pricing_service import PricingNotFoundError, get_price


SAFE_CONTENT_FIELDS = {
    "construction_type",
    "number_of_floors",
    "land_use_zone",
    "boundary_north",
    "boundary_south",
    "boundary_east",
    "boundary_west",
    "property_description",
    "building_age",
    "road_width",
    "property_usage",
}


def _redact_address(address: str | None) -> str | None:
    if not address:
        return None
    parts = [p.strip() for p in address.split(",")]
    if len(parts) <= 1:
        return None
    return ", ".join(parts[1:])


def _round_to_nearest_100(value: Decimal | None) -> int | None:
    if value is None:
        return None
    return round(int(value) / 100) * 100


def _round_coord(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _extract_safe_content(content_json: dict | None) -> dict | None:
    if not content_json:
        return None
    preview: dict = {}
    for section in ("anchor_fields", "additional_fields"):
        fields = content_json.get(section, {})
        for key, field_data in fields.items():
            if key in SAFE_CONTENT_FIELDS and isinstance(field_data, dict):
                preview[key] = field_data.get("value")
    return preview if preview else None


def redact_report_for_listing(
    report: Report, is_purchased: bool = False
) -> RedactedReportPreview:
    return RedactedReportPreview(
        id=report.id,
        report_category=report.report_category.value if hasattr(report.report_category, "value") else str(report.report_category),
        locality=_redact_address(report.property_address),
        city=report.city,
        pin_code=report.pin_code,
        property_type=report.property_type.value if hasattr(report.property_type, "value") else str(report.property_type) if report.property_type else None,
        plot_extent_sqft=_round_to_nearest_100(report.plot_extent_sqft),
        built_up_sqft=_round_to_nearest_100(report.built_up_sqft),
        report_date=report.report_date,
        latitude=_round_coord(report.latitude),
        longitude=_round_coord(report.longitude),
        content_preview=_extract_safe_content(report.content_json),
        is_purchased=is_purchased,
    )


async def _find_or_create_listing(
    db: AsyncSession, report: Report
) -> Listing:
    result = await db.execute(
        select(Listing).where(
            Listing.pin_code == report.pin_code,
            Listing.property_type == report.property_type,
        )
    )
    listing = result.scalar_one_or_none()
    if listing:
        return listing

    locality = _redact_address(report.property_address) or report.city or ""
    listing = Listing(
        macro_location=locality,
        city=report.city or "",
        pin_code=report.pin_code or "",
        property_type=report.property_type,
        status=ListingStatus.AVAILABLE,
        report_count=0,
        vendor_count=0,
    )
    db.add(listing)
    await db.flush()
    return listing


async def _update_listing_metadata(db: AsyncSession, listing: Listing) -> None:
    report_count_result = await db.execute(
        select(func.count()).select_from(ListingReport).where(
            ListingReport.listing_id == listing.id
        )
    )
    listing.report_count = report_count_result.scalar_one()

    vendor_count_result = await db.execute(
        select(func.count(func.distinct(Report.vendor_id)))
        .select_from(ListingReport)
        .join(Report, Report.id == ListingReport.report_id)
        .where(ListingReport.listing_id == listing.id)
    )
    listing.vendor_count = vendor_count_result.scalar_one()

    latest_date_result = await db.execute(
        select(func.max(Report.report_date))
        .select_from(ListingReport)
        .join(Report, Report.id == ListingReport.report_id)
        .where(ListingReport.listing_id == listing.id)
    )
    listing.latest_report_date = latest_date_result.scalar_one()

    if listing.report_count == 0:
        listing.status = ListingStatus.ARCHIVED
    elif listing.status == ListingStatus.ARCHIVED:
        listing.status = ListingStatus.AVAILABLE

    await db.flush()


async def list_report(
    db: AsyncSession, report_id: UUID, vendor_id: UUID
) -> Listing:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise ValueError("Report not found")
    if report.vendor_id != vendor_id:
        raise PermissionError("Not your report")
    if report.status != ReportStatus.PUBLISHED:
        raise ValueError("Report must be published before listing")
    if not report.pin_code:
        raise ValueError("Report must have a pin code to be listed")
    if report.listing_approved:
        raise ValueError("Report is already listed")

    listing = await _find_or_create_listing(db, report)

    lr = ListingReport(
        listing_id=listing.id,
        report_id=report.id,
    )
    db.add(lr)
    report.listing_approved = True
    await db.flush()

    await _update_listing_metadata(db, listing)
    return listing


async def delist_report(
    db: AsyncSession, report_id: UUID, vendor_id: UUID
) -> None:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise ValueError("Report not found")
    if report.vendor_id != vendor_id:
        raise PermissionError("Not your report")
    if not report.listing_approved:
        raise ValueError("Report is not listed")

    lr_result = await db.execute(
        select(ListingReport).where(ListingReport.report_id == report_id)
    )
    lr = lr_result.scalar_one_or_none()
    if not lr:
        raise ValueError("Listing report entry not found")

    listing_id = lr.listing_id
    await db.delete(lr)
    report.listing_approved = False
    await db.flush()

    listing_result = await db.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing:
        await _update_listing_metadata(db, listing)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/listing_service.py
git commit -m "feat(phase5): add listing service with redaction and list/delist logic"
```

---

## Task 5: Listing Service — Lender Queries + Purchase

**Files:**
- Modify: `backend/app/services/listing_service.py`

- [ ] **Step 1: Add lender browse, detail, and purchase functions**

Append to `backend/app/services/listing_service.py`:

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
) -> ListingBrowseResponse:
    stmt = select(Listing).where(
        Listing.status == ListingStatus.AVAILABLE,
        Listing.report_count > 0,
    )
    if city:
        stmt = stmt.where(Listing.city == city)
    if pin_code:
        stmt = stmt.where(Listing.pin_code == pin_code)
    if property_type:
        stmt = stmt.where(Listing.property_type == PropertyType(property_type))

    if report_category:
        cat = ReportCategory(report_category)
        stmt = stmt.where(
            Listing.id.in_(
                select(ListingReport.listing_id)
                .join(Report, Report.id == ListingReport.report_id)
                .where(Report.report_category == cat)
            )
        )

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    stmt = stmt.order_by(Listing.latest_report_date.desc().nullslast())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    listings = list(result.scalars().all())

    return ListingBrowseResponse(
        listings=[ListingResponse.model_validate(l) for l in listings],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_listing_detail(
    db: AsyncSession,
    listing_id: UUID,
    lender_id: UUID,
) -> ListingDetailResponse:
    listing_result = await db.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise ValueError("Listing not found")

    reports_result = await db.execute(
        select(Report)
        .join(ListingReport, ListingReport.report_id == Report.id)
        .where(
            ListingReport.listing_id == listing_id,
            Report.status == ReportStatus.PUBLISHED,
            Report.is_active == True,
        )
        .order_by(Report.report_date.desc().nullslast())
    )
    reports = list(reports_result.scalars().all())

    purchased_result = await db.execute(
        select(ReportPurchase.report_id).where(
            ReportPurchase.lender_id == lender_id,
            ReportPurchase.report_id.in_([r.id for r in reports]) if reports else False,
        )
    )
    purchased_ids = set(purchased_result.scalars().all())

    previews = [
        redact_report_for_listing(r, is_purchased=(r.id in purchased_ids))
        for r in reports
    ]

    return ListingDetailResponse(
        listing=ListingResponse.model_validate(listing),
        reports=previews,
    )


async def purchase_report(
    db: AsyncSession,
    *,
    report_id: UUID,
    listing_id: UUID,
    lender_id: UUID,
    user_id: UUID,
) -> PurchaseResponse:
    lr_result = await db.execute(
        select(ListingReport).where(
            ListingReport.listing_id == listing_id,
            ListingReport.report_id == report_id,
        )
    )
    if not lr_result.scalar_one_or_none():
        raise ValueError("Report is not in this listing")

    existing = await db.execute(
        select(ReportPurchase).where(
            ReportPurchase.report_id == report_id,
            ReportPurchase.lender_id == lender_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Already purchased")

    report_result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise ValueError("Report not found")

    try:
        price_result = await get_price(
            db,
            lender_id=lender_id,
            report_category=report.report_category.value if hasattr(report.report_category, "value") else str(report.report_category),
            city=report.city or "",
            area=None,
            property_type=report.property_type.value if hasattr(report.property_type, "value") else str(report.property_type),
            request_type="LISTING_DOWNLOAD",
        )
    except PricingNotFoundError:
        raise ValueError("No pricing rule configured for this report. Contact admin.")

    purchase = ReportPurchase(
        report_id=report_id,
        listing_id=listing_id,
        lender_id=lender_id,
        purchased_by=user_id,
        price=price_result.amount,
    )
    db.add(purchase)
    await db.flush()

    await create_listing_purchase_entries(
        db,
        report_id=report_id,
        vendor_id=report.vendor_id,
        lender_id=lender_id,
        amount=price_result.amount,
    )

    return PurchaseResponse.model_validate(purchase)


async def get_purchased_reports(
    db: AsyncSession,
    lender_id: UUID,
    *,
    page: int = 1,
    page_size: int = 20,
) -> PurchasedReportsResponse:
    stmt = select(ReportPurchase).where(
        ReportPurchase.lender_id == lender_id
    )

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    stmt = stmt.order_by(ReportPurchase.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    purchases = list(result.scalars().all())

    items = []
    for p in purchases:
        report_result = await db.execute(
            select(Report).where(Report.id == p.report_id)
        )
        report = report_result.scalar_one_or_none()
        if report:
            items.append(PurchasedReportItem(
                purchase=PurchaseResponse.model_validate(p),
                report=ReportResponse.model_validate(report),
            ))

    return PurchasedReportsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_vendor_listings(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    city: str | None = None,
    property_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> VendorListingsResponse:
    listing_ids_stmt = (
        select(ListingReport.listing_id)
        .join(Report, Report.id == ListingReport.report_id)
        .where(Report.vendor_id == vendor_id)
        .distinct()
    )

    stmt = select(Listing).where(Listing.id.in_(listing_ids_stmt))
    if city:
        stmt = stmt.where(Listing.city == city)
    if property_type:
        stmt = stmt.where(Listing.property_type == PropertyType(property_type))

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    stmt = stmt.order_by(Listing.latest_report_date.desc().nullslast())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    listings = list(result.scalars().all())

    groups = []
    for listing in listings:
        reports_result = await db.execute(
            select(Report)
            .join(ListingReport, ListingReport.report_id == Report.id)
            .where(
                ListingReport.listing_id == listing.id,
                Report.vendor_id == vendor_id,
            )
            .order_by(Report.report_date.desc().nullslast())
        )
        reports = list(reports_result.scalars().all())
        groups.append(VendorListingGroup(
            listing=ListingResponse.model_validate(listing),
            reports=[VendorListingReportItem.model_validate(r) for r in reports],
        ))

    return VendorListingsResponse(
        groups=groups,
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_listable_reports(
    db: AsyncSession,
    vendor_id: UUID,
) -> list[VendorListingReportItem]:
    result = await db.execute(
        select(Report).where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
            Report.listing_approved == False,
            Report.is_active == True,
            Report.pin_code.isnot(None),
        ).order_by(Report.report_date.desc().nullslast())
    )
    reports = list(result.scalars().all())
    return [VendorListingReportItem.model_validate(r) for r in reports]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/listing_service.py
git commit -m "feat(phase5): add lender browse, detail, purchase, and vendor listing queries"
```

---

## Task 6: Vendor Listings API Router

**Files:**
- Create: `backend/app/api/vendor/listings.py`

- [ ] **Step 1: Create vendor listings router**

Create `backend/app/api/vendor/listings.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.schemas.listing import VendorListingReportItem, VendorListingsResponse
from app.services import listing_service

router = APIRouter(prefix="/api/vendor/listings", tags=["vendor-listings"])


@router.get("/", response_model=VendorListingsResponse)
async def get_vendor_listings(
    city: str | None = Query(None),
    property_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    return await listing_service.get_vendor_listings(
        db,
        current_user.vendor_id,
        city=city,
        property_type=property_type,
        page=page,
        page_size=page_size,
    )


@router.get("/listable-reports", response_model=list[VendorListingReportItem])
async def get_listable_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    return await listing_service.get_listable_reports(db, current_user.vendor_id)


@router.post("/reports/{report_id}/list", status_code=200)
async def list_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    try:
        listing = await listing_service.list_report(
            db, report_id, current_user.vendor_id
        )
        return {"message": "Report listed", "listing_id": str(listing.id)}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reports/{report_id}/delist", status_code=200)
async def delist_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    try:
        await listing_service.delist_report(db, report_id, current_user.vendor_id)
        return {"message": "Report delisted"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

- [ ] **Step 2: Verify `vendor_id` is accessible on User**

The router uses `current_user.vendor_id`. Confirm this attribute exists on the User model. If it does not, use a query to look up the vendor by `current_user.organization_id`. Check `backend/app/models/user.py` and `backend/app/models/vendor.py` to confirm the relationship.

If `vendor_id` is not on User, replace `current_user.vendor_id` with a lookup:

```python
from app.models.vendor import Vendor

# Inside each endpoint, after getting current_user:
vendor_result = await db.execute(
    select(Vendor).where(Vendor.organization_id == current_user.organization_id)
)
vendor = vendor_result.scalar_one_or_none()
if not vendor:
    raise HTTPException(status_code=404, detail="Vendor not found")
# Then use vendor.id instead of current_user.vendor_id
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/vendor/listings.py
git commit -m "feat(phase5): add vendor listings API router"
```

---

## Task 7: Lender Listings API Router

**Files:**
- Create: `backend/app/api/lender/listings.py`

- [ ] **Step 1: Create lender listings router**

Create `backend/app/api/lender/listings.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.purchase import ReportPurchase
from app.models.report import Report
from app.models.user import User
from app.schemas.listing import ListingBrowseResponse, ListingDetailResponse
from app.schemas.purchase import PurchasedReportsResponse, PurchaseResponse
from app.services import listing_service

router = APIRouter(prefix="/api/lender/listings", tags=["lender-listings"])


@router.get("/", response_model=ListingBrowseResponse)
async def browse_listings(
    city: str | None = Query(None),
    pin_code: str | None = Query(None),
    property_type: str | None = Query(None),
    report_category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    return await listing_service.get_listings(
        db,
        city=city,
        pin_code=pin_code,
        property_type=property_type,
        report_category=report_category,
        page=page,
        page_size=page_size,
    )


@router.get("/purchases", response_model=PurchasedReportsResponse)
async def get_purchased_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    return await listing_service.get_purchased_reports(
        db,
        current_user.lender_id,
        page=page,
        page_size=page_size,
    )


@router.get("/purchases/{purchase_id}/download")
async def download_purchased_report(
    purchase_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    purchase_result = await db.execute(
        select(ReportPurchase).where(
            ReportPurchase.id == purchase_id,
            ReportPurchase.lender_id == current_user.lender_id,
        )
    )
    purchase = purchase_result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    report_result = await db.execute(
        select(Report).where(Report.id == purchase.report_id)
    )
    report = report_result.scalar_one_or_none()
    if not report or not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(
        report.uploaded_file_path,
        media_type="application/pdf",
        filename=f"report-{report.id}.pdf",
    )


@router.get("/{listing_id}", response_model=ListingDetailResponse)
async def get_listing_detail(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    try:
        return await listing_service.get_listing_detail(
            db, listing_id, current_user.lender_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{listing_id}/reports/{report_id}/purchase", response_model=PurchaseResponse)
async def purchase_report(
    listing_id: UUID,
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    try:
        return await listing_service.purchase_report(
            db,
            report_id=report_id,
            listing_id=listing_id,
            lender_id=current_user.lender_id,
            user_id=current_user.id,
        )
    except ValueError as e:
        status = 409 if "Already purchased" in str(e) else 400
        raise HTTPException(status_code=status, detail=str(e))
```

- [ ] **Step 2: Verify `lender_id` is accessible on User**

Same pattern as Task 6 Step 2 — confirm `current_user.lender_id` exists. If not, look up via `current_user.organization_id`:

```python
from app.models.lender import Lender

lender_result = await db.execute(
    select(Lender).where(Lender.organization_id == current_user.organization_id)
)
lender = lender_result.scalar_one_or_none()
if not lender:
    raise HTTPException(status_code=404, detail="Lender not found")
# Use lender.id instead of current_user.lender_id
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/lender/listings.py
git commit -m "feat(phase5): add lender listings API router"
```

---

## Task 8: Router Registration

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Register both new routers in main.py**

Add to `backend/app/main.py` — import section:

```python
from app.api.vendor.listings import router as vendor_listings_router
from app.api.lender.listings import router as lender_listings_router
```

Add to router registration section (after existing `include_router` calls):

```python
app.include_router(vendor_listings_router)
app.include_router(lender_listings_router)
```

- [ ] **Step 2: Verify backend starts without errors**

```bash
docker compose -f docker-compose.local.yml restart backend
docker compose -f docker-compose.local.yml logs backend --tail=20
```

Expected: No import errors, FastAPI startup log shows new routes.

- [ ] **Step 3: Smoke test the endpoints**

```bash
# Health check:
curl http://localhost:8020/api/health

# OpenAPI docs should list new endpoints:
curl http://localhost:8020/openapi.json | python3 -m json.tool | grep -E "vendor/listings|lender/listings"
```

Expected output should include paths for `/api/vendor/listings/`, `/api/lender/listings/`, etc.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(phase5): register vendor and lender listings routers"
```

---

## Task 9: Frontend Types

**Files:**
- Create: `frontend/src/types/listing.ts`

- [ ] **Step 1: Create listing and purchase TypeScript types**

Create `frontend/src/types/listing.ts`:

```typescript
import { Report } from "./report";

export interface ListingResponse {
  id: string;
  macro_location: string;
  city: string;
  pin_code: string;
  property_type: string;
  status: string;
  report_count: number;
  vendor_count: number;
  latest_report_date: string | null;
}

export interface ListingBrowseResponse {
  listings: ListingResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface RedactedReportPreview {
  id: string;
  report_category: string;
  locality: string | null;
  city: string | null;
  pin_code: string | null;
  property_type: string | null;
  plot_extent_sqft: number | null;
  built_up_sqft: number | null;
  report_date: string | null;
  latitude: number | null;
  longitude: number | null;
  content_preview: Record<string, string | number | null> | null;
  is_purchased: boolean;
}

export interface ListingDetailResponse {
  listing: ListingResponse;
  reports: RedactedReportPreview[];
}

export interface VendorListingReportItem {
  id: string;
  report_category: string;
  property_address: string | null;
  city: string | null;
  pin_code: string | null;
  property_type: string | null;
  report_date: string | null;
  status: string;
  listing_approved: boolean;
}

export interface VendorListingGroup {
  listing: ListingResponse;
  reports: VendorListingReportItem[];
}

export interface VendorListingsResponse {
  groups: VendorListingGroup[];
  total: number;
  page: number;
  page_size: number;
}

export interface PurchaseResponse {
  id: string;
  report_id: string;
  listing_id: string;
  lender_id: string;
  price: string;
  created_at: string;
}

export interface PurchasedReportItem {
  purchase: PurchaseResponse;
  report: Report;
}

export interface PurchasedReportsResponse {
  items: PurchasedReportItem[];
  total: number;
  page: number;
  page_size: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/listing.ts
git commit -m "feat(phase5): add listing and purchase TypeScript types"
```

---

## Task 10: Sidebar Navigation Updates

**Files:**
- Modify: `frontend/src/app/lender/layout.tsx`
- Modify: `frontend/src/app/vendor/layout.tsx`

- [ ] **Step 1: Add "Listings" and "Purchased Reports" to lender sidebar**

In `frontend/src/app/lender/layout.tsx`, add two new nav links after the "Requests" link — in BOTH the desktop sidebar `<nav>` and the mobile drawer `<nav>`:

```tsx
<a href="/lender/listings" className="block px-2 py-3 rounded hover:bg-gray-100">Listings</a>
<a href="/lender/listings/purchases" className="block px-2 py-3 rounded hover:bg-gray-100">Purchased Reports</a>
```

The desktop nav section should become:

```tsx
<nav className="space-y-1 text-sm">
  <a href="/lender/dashboard" className="block px-2 py-3 rounded hover:bg-gray-100">Dashboard</a>
  <a href="/lender/requests" className="block px-2 py-3 rounded hover:bg-gray-100">Requests</a>
  <a href="/lender/listings" className="block px-2 py-3 rounded hover:bg-gray-100">Listings</a>
  <a href="/lender/listings/purchases" className="block px-2 py-3 rounded hover:bg-gray-100">Purchased Reports</a>
  <a href="/lender/settings" className="block px-2 py-3 rounded hover:bg-gray-100">Settings</a>
</nav>
```

Apply the same change to the mobile drawer nav section.

- [ ] **Step 2: Add "My Listings" to vendor sidebar**

In `frontend/src/app/vendor/layout.tsx`, add a new nav link after "Reports" — in BOTH the desktop sidebar and mobile drawer:

```tsx
<a href="/vendor/listings" className="block px-2 py-3 rounded hover:bg-gray-100">My Listings</a>
```

The desktop nav section should become:

```tsx
<nav className="space-y-1 text-sm">
  <a href="/vendor/dashboard" className="block px-2 py-3 rounded hover:bg-gray-100">Dashboard</a>
  <a href="/vendor/requests" className="block px-2 py-3 rounded hover:bg-gray-100">Requests</a>
  <a href="/vendor/reports/bulk-upload" className="block px-2 py-3 rounded hover:bg-gray-100">Reports</a>
  <a href="/vendor/listings" className="block px-2 py-3 rounded hover:bg-gray-100">My Listings</a>
  <a href="/vendor/settings" className="block px-2 py-3 rounded hover:bg-gray-100">Settings</a>
</nav>
```

Apply the same change to the mobile drawer nav section.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/layout.tsx frontend/src/app/vendor/layout.tsx
git commit -m "feat(phase5): add listings nav links to lender and vendor sidebars"
```

---

## Task 11: Vendor Listings Page

**Files:**
- Create: `frontend/src/app/vendor/listings/page.tsx`
- Create: `frontend/src/app/vendor/listings/_components/listing-group.tsx`
- Create: `frontend/src/app/vendor/listings/_components/listable-reports.tsx`

- [ ] **Step 1: Create the listable-reports component**

Create `frontend/src/app/vendor/listings/_components/listable-reports.tsx`:

```tsx
"use client";

import { VendorListingReportItem } from "@/types/listing";
import { api } from "@/lib/api";

interface Props {
  reports: VendorListingReportItem[];
  onListed: () => void;
}

export function ListableReports({ reports, onListed }: Props) {
  const handleList = async (reportId: string) => {
    try {
      await api.post(`/api/vendor/listings/reports/${reportId}/list`, {});
      onListed();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to list report";
      alert(message);
    }
  };

  if (reports.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">
        {reports.length} unlisted published report{reports.length !== 1 ? "s" : ""} available
      </h3>
      <div className="space-y-2">
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded bg-white p-3 border"
          >
            <div className="text-sm">
              <span className="font-medium">{r.property_address || "No address"}</span>
              <span className="text-gray-500 ml-2">
                {r.city} · {r.pin_code} · {r.report_category} · {r.property_type}
              </span>
              {r.report_date && (
                <span className="text-gray-400 ml-2">{r.report_date}</span>
              )}
            </div>
            <button
              onClick={() => handleList(r.id)}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"
            >
              List on Marketplace
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the listing-group component**

Create `frontend/src/app/vendor/listings/_components/listing-group.tsx`:

```tsx
"use client";

import { useState } from "react";
import { VendorListingGroup } from "@/types/listing";
import { api } from "@/lib/api";

interface Props {
  group: VendorListingGroup;
  onDelisted: () => void;
}

export function ListingGroup({ group, onDelisted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { listing, reports } = group;

  const handleDelist = async (reportId: string) => {
    try {
      await api.post(`/api/vendor/listings/reports/${reportId}/delist`, {});
      onDelisted();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delist report";
      alert(message);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div>
          <span className="font-medium">{listing.macro_location}</span>
          <span className="text-gray-500 text-sm ml-2">
            {listing.city} · {listing.pin_code} · {listing.property_type}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="divide-y">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4"
            >
              <div className="text-sm">
                <span className="font-medium">{r.property_address || "No address"}</span>
                <div className="text-gray-500 mt-0.5">
                  {r.report_category} · {r.property_type}
                  {r.report_date && ` · ${r.report_date}`}
                </div>
              </div>
              <button
                onClick={() => handleDelist(r.id)}
                className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 shrink-0"
              >
                Delist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the vendor listings page**

Create `frontend/src/app/vendor/listings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  VendorListingsResponse,
  VendorListingReportItem,
} from "@/types/listing";
import { ListingGroup } from "./_components/listing-group";
import { ListableReports } from "./_components/listable-reports";

export default function VendorListingsPage() {
  const [listings, setListings] = useState<VendorListingsResponse | null>(null);
  const [listable, setListable] = useState<VendorListingReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (cityFilter) params.set("city", cityFilter);
      if (propertyTypeFilter) params.set("property_type", propertyTypeFilter);
      params.set("page", String(page));
      const qs = params.toString();

      const [listingsRes, listableRes] = await Promise.all([
        api.get<VendorListingsResponse>(`/api/vendor/listings/?${qs}`),
        api.get<VendorListingReportItem[]>("/api/vendor/listings/listable-reports"),
      ]);
      setListings(listingsRes);
      setListable(listableRes);
    } catch {
      setError("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, cityFilter, propertyTypeFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Listings</h1>

      <ListableReports reports={listable} onListed={fetchData} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by city"
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-48"
        />
        <select
          value={propertyTypeFilter}
          onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-48"
        >
          <option value="">All Property Types</option>
          <option value="RESIDENTIAL">Residential</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="INDUSTRIAL">Industrial</option>
          <option value="AGRICULTURAL">Agricultural</option>
        </select>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : listings && listings.groups.length > 0 ? (
        <>
          <div className="space-y-3">
            {listings.groups.map((g) => (
              <ListingGroup key={g.listing.id} group={g} onDelisted={fetchData} />
            ))}
          </div>

          {/* Pagination */}
          {listings.total > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {Math.ceil(listings.total / 20)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= listings.total}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No listed reports yet. Publish reports and list them on the marketplace above.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify vendor listings page renders**

```bash
# Navigate to http://localhost:3020/vendor/listings after logging in as vendor
# Expected: Page loads with "My Listings" header, shows listable reports or empty state
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/vendor/listings/
git commit -m "feat(phase5): add vendor listings page with list/delist and grouping"
```

---

## Task 12: Lender Listings Browse Page

**Files:**
- Create: `frontend/src/app/lender/listings/page.tsx`
- Create: `frontend/src/app/lender/listings/_components/listing-card.tsx`

- [ ] **Step 1: Create listing card component**

Create `frontend/src/app/lender/listings/_components/listing-card.tsx`:

```tsx
import { ListingResponse } from "@/types/listing";

interface Props {
  listing: ListingResponse;
}

function formatAge(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

const PROPERTY_COLORS: Record<string, string> = {
  RESIDENTIAL: "bg-green-100 text-green-800",
  COMMERCIAL: "bg-blue-100 text-blue-800",
  INDUSTRIAL: "bg-orange-100 text-orange-800",
  AGRICULTURAL: "bg-yellow-100 text-yellow-800",
};

export function ListingCard({ listing }: Props) {
  const colorClass = PROPERTY_COLORS[listing.property_type] || "bg-gray-100 text-gray-800";

  return (
    <a
      href={`/lender/listings/${listing.id}`}
      className="block border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{listing.macro_location}</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${colorClass}`}>
          {listing.property_type}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {listing.city} · {listing.pin_code}
      </p>
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4 text-gray-600">
          <span>{listing.report_count} report{listing.report_count !== 1 ? "s" : ""}</span>
          <span>{listing.vendor_count} vendor{listing.vendor_count !== 1 ? "s" : ""}</span>
        </div>
        <span className="text-gray-400 text-xs">
          {formatAge(listing.latest_report_date)}
        </span>
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Create the listings browse page**

Create `frontend/src/app/lender/listings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ListingBrowseResponse } from "@/types/listing";
import { ListingCard } from "./_components/listing-card";

export default function LenderListingsPage() {
  const [data, setData] = useState<ListingBrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [pinCodeFilter, setPinCodeFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [reportCategoryFilter, setReportCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (cityFilter) params.set("city", cityFilter);
        if (pinCodeFilter) params.set("pin_code", pinCodeFilter);
        if (propertyTypeFilter) params.set("property_type", propertyTypeFilter);
        if (reportCategoryFilter) params.set("report_category", reportCategoryFilter);
        params.set("page", String(page));
        const res = await api.get<ListingBrowseResponse>(`/api/lender/listings/?${params}`);
        setData(res);
      } catch {
        setError("Failed to load listings");
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [page, cityFilter, pinCodeFilter, propertyTypeFilter, reportCategoryFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Listings Marketplace</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="City"
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-40"
        />
        <input
          type="text"
          placeholder="Pin Code"
          value={pinCodeFilter}
          onChange={(e) => { setPinCodeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-36"
        />
        <select
          value={propertyTypeFilter}
          onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-44"
        >
          <option value="">All Property Types</option>
          <option value="RESIDENTIAL">Residential</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="INDUSTRIAL">Industrial</option>
          <option value="AGRICULTURAL">Agricultural</option>
        </select>
        <select
          value={reportCategoryFilter}
          onChange={(e) => { setReportCategoryFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-44"
        >
          <option value="">All Report Types</option>
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading listings...</p>
      ) : data && data.listings.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>

          {data.total > data.page_size && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.page_size >= data.total}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No listings available matching your filters.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/listings/page.tsx frontend/src/app/lender/listings/_components/
git commit -m "feat(phase5): add lender listings browse page with filters"
```

---

## Task 13: Lender Listing Detail Page

**Files:**
- Create: `frontend/src/app/lender/listings/[id]/page.tsx`
- Create: `frontend/src/app/lender/listings/[id]/_components/report-preview-card.tsx`
- Create: `frontend/src/app/lender/listings/[id]/_components/purchase-dialog.tsx`

- [ ] **Step 1: Create purchase confirmation dialog**

Create `frontend/src/app/lender/listings/[id]/_components/purchase-dialog.tsx`:

```tsx
interface Props {
  reportCategory: string;
  locality: string | null;
  price: string | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurchaseDialog({
  reportCategory,
  locality,
  price,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold mb-2">Confirm Purchase</h3>
        <p className="text-sm text-gray-600 mb-4">
          Purchase this {reportCategory.toLowerCase()} report
          {locality ? ` for ${locality}` : ""}?
        </p>
        {price && (
          <p className="text-lg font-bold mb-4">
            Price: <span className="text-green-700">₹{price}</span>
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Buy Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create report preview card component**

Create `frontend/src/app/lender/listings/[id]/_components/report-preview-card.tsx`:

```tsx
import { RedactedReportPreview } from "@/types/listing";

interface Props {
  report: RedactedReportPreview;
  onPurchase: (reportId: string) => void;
  onDownload: (reportId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  VALUATION: "bg-purple-100 text-purple-800",
  LEGAL: "bg-teal-100 text-teal-800",
};

const CONTENT_LABELS: Record<string, string> = {
  construction_type: "Construction",
  number_of_floors: "Floors",
  land_use_zone: "Land Use",
  building_age: "Building Age",
  road_width: "Road Width",
  property_usage: "Usage",
  property_description: "Description",
};

export function ReportPreviewCard({ report, onPurchase, onDownload }: Props) {
  const catColor = CATEGORY_COLORS[report.report_category] || "bg-gray-100 text-gray-800";

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${catColor}`}>
            {report.report_category}
          </span>
          {report.report_date && (
            <span className="text-xs text-gray-400 ml-2">{report.report_date}</span>
          )}
        </div>
        {report.is_purchased && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">
            Purchased
          </span>
        )}
      </div>

      {report.locality && (
        <p className="text-sm font-medium text-gray-800 mb-1">{report.locality}</p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
        {report.property_type && <span>{report.property_type}</span>}
        {report.plot_extent_sqft && <span>Plot: ~{report.plot_extent_sqft} sqft</span>}
        {report.built_up_sqft && <span>Built-up: ~{report.built_up_sqft} sqft</span>}
      </div>

      {/* Content preview from extracted data */}
      {report.content_preview && Object.keys(report.content_preview).length > 0 && (
        <div className="bg-gray-50 rounded p-3 mb-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(report.content_preview).map(([key, value]) => (
              <div key={key}>
                <span className="text-gray-500">{CONTENT_LABELS[key] || key}: </span>
                <span className="text-gray-800">{String(value ?? "—")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        {report.is_purchased ? (
          <button
            onClick={() => onDownload(report.id)}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Download
          </button>
        ) : (
          <button
            onClick={() => onPurchase(report.id)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Buy Report
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the listing detail page**

Create `frontend/src/app/lender/listings/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ListingDetailResponse, RedactedReportPreview } from "@/types/listing";
import { PurchaseResponse } from "@/types/listing";
import { ReportPreviewCard } from "./_components/report-preview-card";
import { PurchaseDialog } from "./_components/purchase-dialog";

export default function LenderListingDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ListingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchasingReport, setPurchasingReport] = useState<RedactedReportPreview | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<ListingDetailResponse>(`/api/lender/listings/${params.id}`);
      setData(res);
    } catch {
      setError("Failed to load listing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  const handlePurchase = async () => {
    if (!purchasingReport || !data) return;
    setPurchaseLoading(true);
    try {
      await api.post<PurchaseResponse>(
        `/api/lender/listings/${data.listing.id}/reports/${purchasingReport.id}/purchase`,
        {}
      );
      setPurchasingReport(null);
      await fetchDetail();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Purchase failed";
      alert(message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleDownload = async (_reportId: string) => {
    // After purchase, redirect user to purchased reports page for download.
    // The download endpoint requires a purchase_id, not report_id.
    window.location.href = "/lender/listings/purchases";
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Listing not found</p>;

  const { listing, reports } = data;

  return (
    <div>
      <a href="/lender/listings" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Listings
      </a>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{listing.macro_location}</h1>
        <p className="text-gray-500">
          {listing.city} · {listing.pin_code} · {listing.property_type}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {listing.report_count} report{listing.report_count !== 1 ? "s" : ""} ·{" "}
          {listing.vendor_count} vendor{listing.vendor_count !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-4">
        {reports.map((r) => (
          <ReportPreviewCard
            key={r.id}
            report={r}
            onPurchase={(id) => {
              const report = reports.find((rp) => rp.id === id);
              if (report) setPurchasingReport(report);
            }}
            onDownload={handleDownload}
          />
        ))}
      </div>

      {reports.length === 0 && (
        <p className="text-gray-500">No reports available in this listing.</p>
      )}

      {purchasingReport && (
        <PurchaseDialog
          reportCategory={purchasingReport.report_category}
          locality={purchasingReport.locality}
          price={null}
          loading={purchaseLoading}
          onConfirm={handlePurchase}
          onCancel={() => setPurchasingReport(null)}
        />
      )}
    </div>
  );
}
```

**Note:** The download endpoint uses `purchase_id` not `report_id`. For simplicity, the listing detail page redirects to the Purchased Reports page for downloads. After purchasing, the report card shows a "Go to Purchased Reports" link for download.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/lender/listings/\[id\]/
git commit -m "feat(phase5): add lender listing detail page with purchase flow"
```

---

## Task 14: Lender Purchased Reports Page

**Files:**
- Create: `frontend/src/app/lender/listings/purchases/page.tsx`

- [ ] **Step 1: Create the purchased reports page**

Create `frontend/src/app/lender/listings/purchases/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PurchasedReportsResponse } from "@/types/listing";

export default function PurchasedReportsPage() {
  const [data, setData] = useState<PurchasedReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<PurchasedReportsResponse>(
          `/api/lender/listings/purchases?page=${page}`
        );
        setData(res);
      } catch {
        setError("Failed to load purchases");
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [page]);

  const handleDownload = async (purchaseId: string) => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/lender/listings/purchases/${purchaseId}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${purchaseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download report");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Purchased Reports</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data && data.items.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Location</th>
                  <th className="text-left p-3 font-medium">City</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Purchased</th>
                  <th className="text-right p-3 font-medium">Price</th>
                  <th className="text-right p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((item) => (
                  <tr key={item.purchase.id} className="hover:bg-gray-50">
                    <td className="p-3">{item.report.property_address || "—"}</td>
                    <td className="p-3">{item.report.city || "—"}</td>
                    <td className="p-3">{item.report.property_type || "—"}</td>
                    <td className="p-3">{item.report.report_category}</td>
                    <td className="p-3">{new Date(item.purchase.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right">₹{item.purchase.price}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDownload(item.purchase.id)}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.items.map((item) => (
              <div key={item.purchase.id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm">{item.report.property_address || "—"}</p>
                    <p className="text-xs text-gray-500">{item.report.city} · {item.report.property_type}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100">{item.report.report_category}</span>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <div className="text-sm">
                    <span className="text-gray-500">₹{item.purchase.price}</span>
                    <span className="text-gray-400 ml-2">{new Date(item.purchase.created_at).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => handleDownload(item.purchase.id)}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.total > data.page_size && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.page_size >= data.total}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No purchased reports yet. Browse the <a href="/lender/listings" className="text-blue-600 hover:underline">listings marketplace</a> to find reports.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/lender/listings/purchases/
git commit -m "feat(phase5): add lender purchased reports page with download"
```

---

## Task 15: End-to-End Verification

- [ ] **Step 1: Rebuild and restart all services**

```bash
docker compose -f docker-compose.local.yml down
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
```

- [ ] **Step 2: Run migration if not already applied**

```bash
docker compose -f docker-compose.local.yml exec backend alembic upgrade head
```

- [ ] **Step 3: Verify backend endpoints respond**

```bash
# Check OpenAPI shows all new endpoints
curl -s http://localhost:8020/openapi.json | python3 -c "
import json, sys
spec = json.load(sys.stdin)
for path in sorted(spec['paths']):
    if 'listing' in path:
        methods = list(spec['paths'][path].keys())
        print(f'{path}: {methods}')
"
```

Expected output should list all 9 endpoints (4 vendor + 5 lender).

- [ ] **Step 4: Manual smoke test**

1. Log in as vendor (`vendor@valuepro.com` / `vendor123`)
2. Navigate to `/vendor/listings` — should show empty state with any listable reports
3. If there are published reports, list one → verify it appears in the listings group
4. Log in as lender (`lender@abcl.com` / `lender123`)
5. Navigate to `/lender/listings` — should show the listing created above
6. Click into the listing detail — should show redacted report preview
7. Attempt purchase — verify billing entries are created
8. Navigate to `/lender/listings/purchases` — should show the purchased report with download

- [ ] **Step 5: Commit any fixes discovered during testing**

```bash
git add -A
git commit -m "fix(phase5): address issues found during e2e verification"
```

---

## Task 16: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Phase 5 status in CLAUDE.md**

Update the "Current Status" section to reflect Phase 5 completion:

```
**Phase 5 (Listings Marketplace):** Complete — listing service (auto-grouping by pin_code + property_type, PII redaction), ReportPurchase model, vendor listings API (4 endpoints: list/delist/browse/listable), lender listings API (5 endpoints: browse/detail/purchase/purchases/download), billing integration (LISTING_DOWNLOAD entries), 5 frontend pages (vendor listings management, lender browse/detail/purchases), sidebar navigation updates
```

Add to "Key Files" section:

```
- `backend/app/models/purchase.py` — ReportPurchase model (listing report purchases)
- `backend/app/services/listing_service.py` — Listing CRUD, PII redaction, browse, purchase
- `backend/app/api/vendor/listings.py` — Vendor listing endpoints (list/delist/browse)
- `backend/app/api/lender/listings.py` — Lender listing endpoints (browse/detail/purchase/download)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Phase 5 completion status"
```
