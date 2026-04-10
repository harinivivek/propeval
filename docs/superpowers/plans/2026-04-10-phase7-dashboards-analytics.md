# Phase 7: Dashboards & Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build data-rich dashboards for vendor, lender, and admin portals with notifications, analytics charts, and CSV export.

**Architecture:** Direct aggregation queries on existing tables (VendorEarning, LenderPayable, ReportRequest, Report, ReportPurchase). New Notification model for event-driven alerts. Polling-based delivery reusing existing `use-polling` pattern. Server-side CSV streaming for admin exports.

**Tech Stack:** FastAPI + SQLAlchemy async (backend), Next.js 15 + Recharts + Tailwind CSS (frontend), PostgreSQL aggregation queries.

**Spec:** `docs/superpowers/specs/2026-04-10-phase7-dashboards-analytics-design.md`

---

## File Structure

### Backend — New Files
- `backend/app/models/notification.py` — Notification model
- `backend/app/schemas/notification.py` — Notification Pydantic schemas
- `backend/app/schemas/dashboard.py` — Dashboard response schemas
- `backend/app/services/notification_service.py` — Notification CRUD
- `backend/app/services/dashboard_service.py` — Aggregation queries
- `backend/app/services/csv_export_service.py` — CSV streaming
- `backend/app/api/notifications.py` — Notification endpoints
- `backend/app/api/vendor/dashboard.py` — Vendor dashboard endpoints
- `backend/app/api/lender/dashboard.py` — Lender dashboard endpoints
- `backend/app/api/admin/dashboard.py` — Admin dashboard endpoints

### Backend — Modified Files
- `backend/app/models/enums.py` — Add NotificationEventType, NotificationReferenceType
- `backend/app/models/__init__.py` — Register Notification model
- `backend/app/main.py` — Register 4 new routers
- `backend/app/services/broadcast_service.py` — Wire NEW_BROADCAST notification
- `backend/app/services/request_service.py` — Wire REQUEST_ACCEPTED notification
- `backend/app/services/report_service.py` — Wire REVISION_REQUESTED notification
- `backend/app/services/listing_service.py` — Wire LISTING_DOWNLOADED notification

### Frontend — New Files
- `frontend/src/types/dashboard.ts` — Dashboard response types
- `frontend/src/types/notification.ts` — Notification types
- `frontend/src/hooks/use-notifications.ts` — Notification polling hook
- `frontend/src/components/notification-bell.tsx` — Bell dropdown component
- `frontend/src/components/metric-card.tsx` — Reusable stat widget
- `frontend/src/components/date-range-filter.tsx` — Financial year picker
- `frontend/src/app/vendor/dashboard/_components/vendor-stats.tsx`
- `frontend/src/app/vendor/dashboard/_components/receivables-section.tsx`
- `frontend/src/app/vendor/dashboard/_components/earnings-charts.tsx`
- `frontend/src/app/vendor/dashboard/_components/pending-requests-table.tsx`
- `frontend/src/app/vendor/dashboard/_components/reports-table.tsx`
- `frontend/src/app/lender/dashboard/_components/lender-stats.tsx`
- `frontend/src/app/lender/dashboard/_components/payables-section.tsx`
- `frontend/src/app/lender/dashboard/_components/recent-requests-table.tsx`
- `frontend/src/app/admin/dashboard/_components/admin-stats.tsx`
- `frontend/src/app/admin/dashboard/_components/vendors-tab.tsx`
- `frontend/src/app/admin/dashboard/_components/lenders-tab.tsx`
- `frontend/src/app/admin/dashboard/_components/reports-tab.tsx`
- `frontend/src/app/admin/dashboard/_components/open-requests-tab.tsx`

### Frontend — Modified Files
- `frontend/src/app/vendor/dashboard/page.tsx` — Replace placeholder
- `frontend/src/app/lender/dashboard/page.tsx` — Replace placeholder
- `frontend/src/app/admin/dashboard/page.tsx` — Replace placeholder
- `frontend/src/app/vendor/layout.tsx` — Add NotificationBell to header
- `frontend/src/app/lender/layout.tsx` — Add NotificationBell to header
- `frontend/src/app/admin/layout.tsx` — Add NotificationBell to header

---

## Task 1: Notification Enums & Model

**Files:**
- Modify: `backend/app/models/enums.py`
- Create: `backend/app/models/notification.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Add notification enums to `backend/app/models/enums.py`**

Add these two enums after the existing enum definitions:

```python
class NotificationEventType(str, Enum):
    NEW_BROADCAST = "NEW_BROADCAST"
    REQUEST_ACCEPTED = "REQUEST_ACCEPTED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    LISTING_DOWNLOADED = "LISTING_DOWNLOADED"


class NotificationReferenceType(str, Enum):
    REQUEST = "REQUEST"
    REPORT = "REPORT"
```

- [ ] **Step 2: Create `backend/app/models/notification.py`**

```python
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import NotificationEventType, NotificationReferenceType


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[NotificationEventType] = mapped_column(
        String(50), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    reference_id: Mapped[UUID] = mapped_column()
    reference_type: Mapped[NotificationReferenceType] = mapped_column(String(20))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
```

- [ ] **Step 3: Register model in `backend/app/models/__init__.py`**

Add to imports:

```python
from app.models.notification import Notification
```

Add `"Notification"` to the `__all__` list.

- [ ] **Step 4: Generate Alembic migration**

```bash
docker compose -f docker-compose.local.yml exec backend alembic revision --autogenerate -m "add notifications table"
```

Then copy migration file to host:

```bash
docker cp propeval-backend-1:/app/alembic/versions/<generated_file>.py backend/alembic/versions/
```

- [ ] **Step 5: Run migration**

```bash
make migrate
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/enums.py backend/app/models/notification.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat(phase7): add Notification model and enums"
```

---

## Task 2: Notification Schemas

**Files:**
- Create: `backend/app/schemas/notification.py`

- [ ] **Step 1: Create `backend/app/schemas/notification.py`**

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    user_id: UUID
    event_type: str
    title: str
    message: str
    reference_id: UUID
    reference_type: str
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    count: int
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/notification.py
git commit -m "feat(phase7): add notification Pydantic schemas"
```

---

## Task 3: Notification Service

**Files:**
- Create: `backend/app/services/notification_service.py`

- [ ] **Step 1: Create `backend/app/services/notification_service.py`**

```python
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    *,
    user_id: UUID,
    event_type: NotificationEventType,
    title: str,
    message: str,
    reference_id: UUID,
    reference_type: NotificationReferenceType,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        event_type=event_type.value,
        title=title,
        message=message,
        reference_id=reference_id,
        reference_type=reference_type.value,
        is_read=False,
    )
    db.add(notification)
    await db.flush()
    return notification


async def get_notifications(
    db: AsyncSession, *, user_id: UUID, page: int = 1, page_size: int = 20
) -> tuple[list[Notification], int]:
    count_stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id
    )
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_unread_count(db: AsyncSession, *, user_id: UUID) -> int:
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id,
        Notification.is_read == False,  # noqa: E712
    )
    return (await db.execute(stmt)).scalar_one()


async def mark_as_read(
    db: AsyncSession, *, notification_id: UUID, user_id: UUID
) -> None:
    stmt = (
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
        .values(is_read=True)
    )
    await db.execute(stmt)


async def mark_all_as_read(db: AsyncSession, *, user_id: UUID) -> None:
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.execute(stmt)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/notification_service.py
git commit -m "feat(phase7): add notification service"
```

---

## Task 4: Notification API Router

**Files:**
- Create: `backend/app/api/notifications.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/api/notifications.py`**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications, total = await notification_service.get_notifications(
        db, user_id=current_user.id, page=page, page_size=page_size
    )
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await notification_service.get_unread_count(db, user_id=current_user.id)
    return UnreadCountResponse(count=count)


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await notification_service.mark_as_read(
        db, notification_id=notification_id, user_id=current_user.id
    )
    return {"status": "ok"}


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await notification_service.mark_all_as_read(db, user_id=current_user.id)
    return {"status": "ok"}
```

- [ ] **Step 2: Register router in `backend/app/main.py`**

Add import:

```python
from app.api.notifications import router as notifications_router
```

Add registration after the existing router includes:

```python
app.include_router(notifications_router)
```

- [ ] **Step 3: Verify endpoint loads**

```bash
docker compose -f docker-compose.local.yml restart backend
curl -s http://localhost:8020/api/health | head -1
```

Expected: `{"status":"healthy"}` or similar health response.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/notifications.py backend/app/main.py
git commit -m "feat(phase7): add notification API endpoints"
```

---

## Task 5: Dashboard Schemas

**Files:**
- Create: `backend/app/schemas/dashboard.py`

- [ ] **Step 1: Create `backend/app/schemas/dashboard.py`**

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# --- Vendor Dashboard ---

class VendorDashboardStats(BaseModel):
    requests_received: int
    requests_accepted: int
    reports_served: int
    reports_listed: int
    downloads: int
    active_listings: int


class LenderEarning(BaseModel):
    lender_id: UUID
    lender_name: str
    total_amount: str


class MonthlyAmount(BaseModel):
    month: str
    total_amount: str


class VendorReceivablesResponse(BaseModel):
    lender_wise: list[LenderEarning]
    month_wise: list[MonthlyAmount]


class ReportEarning(BaseModel):
    report_id: UUID
    property_address: str | None
    report_category: str
    total_amount: str


class VendorEarningsResponse(BaseModel):
    lender_wise: list[LenderEarning]
    report_wise: list[ReportEarning]
    report_wise_total: int
    month_wise: list[MonthlyAmount]


class PendingRequestItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_name: str
    property_address: str | None
    report_category: str
    eta_days: int | None
    price: str | None
    vendor_status: str
    accept_deadline: datetime | None
    created_at: datetime


class VendorReportItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_date: str | None
    property_address: str | None
    report_category: str
    property_type: str | None
    status: str
    valuation_amount: str | None


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# --- Lender Dashboard ---

class LenderDashboardStats(BaseModel):
    requests_raised: int
    awaiting_reports: int
    reports_received: int
    reports_accepted: int
    listings_purchased: int


class PayableSummaryTotals(BaseModel):
    pending: str
    billed: str
    paid: str


class PayableTypeAmount(BaseModel):
    payable_type: str
    total_amount: str


class LenderPayablesResponse(BaseModel):
    totals: PayableSummaryTotals
    month_wise: list[MonthlyAmount]
    type_breakdown: list[PayableTypeAmount]


class RecentRequestItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    property_address: str | None
    report_category: str
    lender_status: str
    vendor_name: str | None
    created_at: datetime


# --- Admin Dashboard ---

class AdminDashboardStats(BaseModel):
    total_vendors: int
    total_lenders: int
    total_reports: int
    total_revenue: str
    pending_payables: str
    open_requests: int


class AdminVendorRow(BaseModel):
    vendor_id: UUID
    vendor_name: str
    city: str | None
    requests_served: int
    reports_uploaded: int
    active_listings: int
    downloads: int
    total_earnings: str
    lender_count: int


class AdminLenderRow(BaseModel):
    lender_id: UUID
    lender_name: str
    city: str | None
    requests_raised: int
    reports_received: int
    listings_purchased: int
    total_payable: str
    total_paid: str
    vendor_count: int


class AdminReportRow(BaseModel):
    report_id: UUID
    report_date: str | None
    vendor_name: str
    lender_name: str | None
    property_address: str | None
    report_category: str
    property_type: str | None
    status: str
    valuation_amount: str | None


class AdminOpenRequestRow(BaseModel):
    request_id: UUID
    lender_name: str
    property_address: str | None
    report_category: str
    lender_status: str
    vendor_name: str | None
    created_at: datetime
    eta_days: int | None
    broadcast_round: int | None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/dashboard.py
git commit -m "feat(phase7): add dashboard Pydantic schemas"
```

---

## Task 6: Dashboard Service — Vendor Functions

**Files:**
- Create: `backend/app/services/dashboard_service.py`

- [ ] **Step 1: Create `backend/app/services/dashboard_service.py` with vendor functions**

```python
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import LenderPayable, VendorEarning
from app.models.lender import Lender
from app.models.listing import Listing, ListingReport
from app.models.purchase import ReportPurchase
from app.models.report import Report
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.vendor import Vendor


def _get_fy_range(fy_year: int | None = None) -> tuple[str, str]:
    """Return (start_month, end_month) strings for the Indian financial year.
    If fy_year is None, uses current date to determine FY.
    fy_year=2026 means Apr 2026 - Mar 2027.
    """
    if fy_year is None:
        today = date.today()
        fy_year = today.year if today.month >= 4 else today.year - 1
    return f"{fy_year}-04", f"{fy_year + 1}-03"


async def get_vendor_dashboard_stats(
    db: AsyncSession, *, vendor_id: UUID
) -> dict:
    requests_received = (await db.execute(
        select(func.count()).select_from(RequestAcceptance)
        .where(RequestAcceptance.vendor_id == vendor_id)
    )).scalar_one()

    requests_accepted = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .join(RequestAcceptance, RequestAcceptance.request_id == ReportRequest.id)
        .where(
            RequestAcceptance.vendor_id == vendor_id,
            ReportRequest.vendor_status == "ACCEPTED",
        )
    )).scalar_one()

    reports_served = (await db.execute(
        select(func.count()).select_from(Report)
        .join(RequestAcceptance, RequestAcceptance.report_id == Report.id)
        .where(
            RequestAcceptance.vendor_id == vendor_id,
            Report.status == "PUBLISHED",
        )
    )).scalar_one()

    reports_listed = (await db.execute(
        select(func.count()).select_from(Report)
        .where(Report.vendor_id == vendor_id, Report.listing_approved == True)  # noqa: E712
    )).scalar_one()

    downloads = (await db.execute(
        select(func.count()).select_from(ReportPurchase)
        .join(Report, Report.id == ReportPurchase.report_id)
        .where(Report.vendor_id == vendor_id)
    )).scalar_one()

    active_listings = (await db.execute(
        select(func.count(distinct(Listing.id)))
        .select_from(Listing)
        .join(ListingReport, ListingReport.listing_id == Listing.id)
        .join(Report, Report.id == ListingReport.report_id)
        .where(Report.vendor_id == vendor_id, Listing.status == "AVAILABLE")
    )).scalar_one()

    return {
        "requests_received": requests_received,
        "requests_accepted": requests_accepted,
        "reports_served": reports_served,
        "reports_listed": reports_listed,
        "downloads": downloads,
        "active_listings": active_listings,
    }


async def get_vendor_receivables(
    db: AsyncSession, *, vendor_id: UUID, fy_year: int | None = None
) -> dict:
    fy_start, fy_end = _get_fy_range(fy_year)

    lender_wise_stmt = (
        select(
            VendorEarning.lender_id,
            Lender.name.label("lender_name"),
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .join(Lender, Lender.id == VendorEarning.lender_id)
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.lender_id, Lender.name)
        .order_by(func.sum(VendorEarning.amount).desc())
    )
    lender_rows = (await db.execute(lender_wise_stmt)).all()

    month_wise_stmt = (
        select(
            VendorEarning.month,
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.month)
        .order_by(VendorEarning.month)
    )
    month_rows = (await db.execute(month_wise_stmt)).all()

    return {
        "lender_wise": [
            {"lender_id": str(r.lender_id), "lender_name": r.lender_name, "total_amount": str(r.total_amount)}
            for r in lender_rows
        ],
        "month_wise": [
            {"month": r.month, "total_amount": str(r.total_amount)}
            for r in month_rows
        ],
    }


async def get_vendor_earnings_analytics(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    fy_year: int | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    fy_start, fy_end = _get_fy_range(fy_year)

    lender_wise_stmt = (
        select(
            VendorEarning.lender_id,
            Lender.name.label("lender_name"),
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .join(Lender, Lender.id == VendorEarning.lender_id)
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.lender_id, Lender.name)
        .order_by(func.sum(VendorEarning.amount).desc())
    )
    lender_rows = (await db.execute(lender_wise_stmt)).all()

    report_count_stmt = (
        select(func.count(distinct(VendorEarning.report_id)))
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
    )
    report_wise_total = (await db.execute(report_count_stmt)).scalar_one()

    report_wise_stmt = (
        select(
            VendorEarning.report_id,
            Report.property_address,
            Report.report_category,
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .join(Report, Report.id == VendorEarning.report_id)
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.report_id, Report.property_address, Report.report_category)
        .order_by(func.sum(VendorEarning.amount).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    report_rows = (await db.execute(report_wise_stmt)).all()

    month_wise_stmt = (
        select(
            VendorEarning.month,
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.month)
        .order_by(VendorEarning.month)
    )
    month_rows = (await db.execute(month_wise_stmt)).all()

    return {
        "lender_wise": [
            {"lender_id": str(r.lender_id), "lender_name": r.lender_name, "total_amount": str(r.total_amount)}
            for r in lender_rows
        ],
        "report_wise": [
            {
                "report_id": str(r.report_id),
                "property_address": r.property_address,
                "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
                "total_amount": str(r.total_amount),
            }
            for r in report_rows
        ],
        "report_wise_total": report_wise_total,
        "month_wise": [
            {"month": r.month, "total_amount": str(r.total_amount)}
            for r in month_rows
        ],
    }


async def get_vendor_pending_requests(
    db: AsyncSession, *, vendor_id: UUID
) -> list[dict]:
    stmt = (
        select(
            ReportRequest.id,
            Lender.name.label("lender_name"),
            ReportRequest.property_address,
            ReportRequest.report_category,
            ReportRequest.eta_days,
            ReportRequest.price,
            ReportRequest.vendor_status,
            RequestBroadcast.accept_deadline,
            ReportRequest.created_at,
        )
        .join(Lender, Lender.id == ReportRequest.lender_id)
        .join(RequestBroadcast, RequestBroadcast.request_id == ReportRequest.id)
        .where(
            ReportRequest.vendor_status.in_(["INCOMING", "PENDING"]),
            RequestBroadcast.vendor_ids.any(str(vendor_id)),
            RequestBroadcast.status == "ACTIVE",
        )
        .order_by(RequestBroadcast.accept_deadline.asc())
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "id": str(r.id),
            "lender_name": r.lender_name,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "eta_days": r.eta_days,
            "price": str(r.price) if r.price else None,
            "vendor_status": r.vendor_status.value if hasattr(r.vendor_status, "value") else str(r.vendor_status),
            "accept_deadline": r.accept_deadline.isoformat() if r.accept_deadline else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


async def get_vendor_reports_table(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    search: str | None = None,
    status_filter: str | None = None,
    category_filter: str | None = None,
    property_type_filter: str | None = None,
    sort_by: str = "report_date",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    base = select(Report).where(Report.vendor_id == vendor_id, Report.is_active == True)  # noqa: E712

    if search:
        base = base.where(
            Report.property_address.ilike(f"%{search}%")
            | Report.loan_applicant_name.ilike(f"%{search}%")
        )
    if status_filter:
        base = base.where(Report.status == status_filter)
    if category_filter:
        base = base.where(Report.report_category == category_filter)
    if property_type_filter:
        base = base.where(Report.property_type == property_type_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    sort_col = getattr(Report, sort_by, Report.report_date)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    reports = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": str(r.id),
            "report_date": str(r.report_date) if r.report_date else None,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "property_type": r.property_type.value if r.property_type and hasattr(r.property_type, "value") else (str(r.property_type) if r.property_type else None),
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "valuation_amount": str(r.valuation_amount) if r.valuation_amount else None,
        }
        for r in reports
    ], total
```

- [ ] **Step 2: Verify import works**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.dashboard_service import get_vendor_dashboard_stats; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/dashboard_service.py
git commit -m "feat(phase7): add dashboard service with vendor functions"
```

---

## Task 7: Dashboard Service — Lender & Admin Functions

**Files:**
- Modify: `backend/app/services/dashboard_service.py`

- [ ] **Step 1: Add lender functions to `backend/app/services/dashboard_service.py`**

Append after the vendor functions:

```python
async def get_lender_dashboard_stats(
    db: AsyncSession, *, lender_id: UUID
) -> dict:
    requests_raised = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id)
    )).scalar_one()

    awaiting_reports = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id, ReportRequest.lender_status == "AWAITED")
    )).scalar_one()

    reports_received = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id, ReportRequest.lender_status == "RECEIVED")
    )).scalar_one()

    reports_accepted = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id, ReportRequest.lender_status == "ACCEPTED")
    )).scalar_one()

    listings_purchased = (await db.execute(
        select(func.count()).select_from(ReportPurchase)
        .where(ReportPurchase.lender_id == lender_id)
    )).scalar_one()

    return {
        "requests_raised": requests_raised,
        "awaiting_reports": awaiting_reports,
        "reports_received": reports_received,
        "reports_accepted": reports_accepted,
        "listings_purchased": listings_purchased,
    }


async def get_lender_payables_summary(
    db: AsyncSession, *, lender_id: UUID, fy_year: int | None = None
) -> dict:
    fy_start, fy_end = _get_fy_range(fy_year)

    totals_stmt = (
        select(
            func.coalesce(
                func.sum(case((LenderPayable.status == "PENDING", LenderPayable.amount))),
                Decimal("0"),
            ).label("pending"),
            func.coalesce(
                func.sum(case((LenderPayable.status == "BILLED", LenderPayable.amount))),
                Decimal("0"),
            ).label("billed"),
            func.coalesce(
                func.sum(case((LenderPayable.status == "PAID", LenderPayable.amount))),
                Decimal("0"),
            ).label("paid"),
        )
        .where(LenderPayable.lender_id == lender_id)
    )
    totals = (await db.execute(totals_stmt)).one()

    month_wise_stmt = (
        select(
            LenderPayable.month,
            func.sum(LenderPayable.amount).label("total_amount"),
        )
        .where(
            LenderPayable.lender_id == lender_id,
            LenderPayable.month >= fy_start,
            LenderPayable.month <= fy_end,
        )
        .group_by(LenderPayable.month)
        .order_by(LenderPayable.month)
    )
    month_rows = (await db.execute(month_wise_stmt)).all()

    type_stmt = (
        select(
            LenderPayable.payable_type,
            func.sum(LenderPayable.amount).label("total_amount"),
        )
        .where(
            LenderPayable.lender_id == lender_id,
            LenderPayable.month >= fy_start,
            LenderPayable.month <= fy_end,
        )
        .group_by(LenderPayable.payable_type)
    )
    type_rows = (await db.execute(type_stmt)).all()

    return {
        "totals": {
            "pending": str(totals.pending),
            "billed": str(totals.billed),
            "paid": str(totals.paid),
        },
        "month_wise": [
            {"month": r.month, "total_amount": str(r.total_amount)}
            for r in month_rows
        ],
        "type_breakdown": [
            {
                "payable_type": r.payable_type.value if hasattr(r.payable_type, "value") else str(r.payable_type),
                "total_amount": str(r.total_amount),
            }
            for r in type_rows
        ],
    }


async def get_lender_recent_requests(
    db: AsyncSession, *, lender_id: UUID, limit: int = 10
) -> list[dict]:
    stmt = (
        select(
            ReportRequest.id,
            ReportRequest.property_address,
            ReportRequest.report_category,
            ReportRequest.lender_status,
            ReportRequest.created_at,
            Vendor.name.label("vendor_name"),
        )
        .outerjoin(RequestAcceptance, RequestAcceptance.request_id == ReportRequest.id)
        .outerjoin(Vendor, Vendor.id == RequestAcceptance.vendor_id)
        .where(ReportRequest.lender_id == lender_id)
        .order_by(ReportRequest.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "id": str(r.id),
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "lender_status": r.lender_status.value if hasattr(r.lender_status, "value") else str(r.lender_status),
            "vendor_name": r.vendor_name,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
```

- [ ] **Step 2: Add admin functions to the same file**

Append after the lender functions:

```python
async def get_admin_dashboard_stats(db: AsyncSession) -> dict:
    total_vendors = (await db.execute(
        select(func.count()).select_from(Vendor)
    )).scalar_one()

    total_lenders = (await db.execute(
        select(func.count()).select_from(Lender)
    )).scalar_one()

    total_reports = (await db.execute(
        select(func.count()).select_from(Report)
    )).scalar_one()

    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(LenderPayable.amount), Decimal("0")))
    )).scalar_one()

    pending_payables = (await db.execute(
        select(func.coalesce(func.sum(LenderPayable.amount), Decimal("0")))
        .where(LenderPayable.status == "PENDING")
    )).scalar_one()

    open_requests = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_status.in_(["SENT", "AWAITED"]))
    )).scalar_one()

    return {
        "total_vendors": total_vendors,
        "total_lenders": total_lenders,
        "total_reports": total_reports,
        "total_revenue": str(total_revenue),
        "pending_payables": str(pending_payables),
        "open_requests": open_requests,
    }


async def get_admin_vendors_table(
    db: AsyncSession,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    city_filter: str | None = None,
    category_filter: str | None = None,
    sort_by: str = "vendor_name",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    base = (
        select(
            Vendor.id.label("vendor_id"),
            Vendor.name.label("vendor_name"),
            Vendor.office_city.label("city"),
            func.count(distinct(RequestAcceptance.id)).label("requests_served"),
            func.count(distinct(Report.id)).label("reports_uploaded"),
            func.coalesce(func.sum(distinct(VendorEarning.amount)), Decimal("0")).label("total_earnings"),
        )
        .outerjoin(RequestAcceptance, RequestAcceptance.vendor_id == Vendor.id)
        .outerjoin(Report, Report.vendor_id == Vendor.id)
        .outerjoin(VendorEarning, VendorEarning.vendor_id == Vendor.id)
        .group_by(Vendor.id, Vendor.name, Vendor.office_city)
    )

    if city_filter:
        base = base.where(Vendor.office_city.ilike(f"%{city_filter}%"))

    count_stmt = select(func.count()).select_from(Vendor)
    if city_filter:
        count_stmt = count_stmt.where(Vendor.office_city.ilike(f"%{city_filter}%"))
    total = (await db.execute(count_stmt)).scalar_one()

    sort_map = {
        "vendor_name": Vendor.name,
        "city": Vendor.office_city,
        "total_earnings": func.coalesce(func.sum(VendorEarning.amount), Decimal("0")),
    }
    sort_col = sort_map.get(sort_by, Vendor.name)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    result = []
    for r in rows:
        downloads = (await db.execute(
            select(func.count()).select_from(ReportPurchase)
            .join(Report, Report.id == ReportPurchase.report_id)
            .where(Report.vendor_id == r.vendor_id)
        )).scalar_one()

        active_listings = (await db.execute(
            select(func.count(distinct(Listing.id)))
            .select_from(Listing)
            .join(ListingReport, ListingReport.listing_id == Listing.id)
            .join(Report, Report.id == ListingReport.report_id)
            .where(Report.vendor_id == r.vendor_id, Listing.status == "AVAILABLE")
        )).scalar_one()

        lender_count = (await db.execute(
            select(func.count(distinct(VendorEarning.lender_id)))
            .where(VendorEarning.vendor_id == r.vendor_id)
        )).scalar_one()

        result.append({
            "vendor_id": str(r.vendor_id),
            "vendor_name": r.vendor_name,
            "city": r.city,
            "requests_served": r.requests_served,
            "reports_uploaded": r.reports_uploaded,
            "active_listings": active_listings,
            "downloads": downloads,
            "total_earnings": str(r.total_earnings),
            "lender_count": lender_count,
        })

    return result, total


async def get_admin_lenders_table(
    db: AsyncSession,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    city_filter: str | None = None,
    sort_by: str = "lender_name",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    count_stmt = select(func.count()).select_from(Lender)
    if city_filter:
        count_stmt = count_stmt.where(Lender.city.ilike(f"%{city_filter}%"))
    total = (await db.execute(count_stmt)).scalar_one()

    base = (
        select(
            Lender.id.label("lender_id"),
            Lender.name.label("lender_name"),
            Lender.city,
        )
    )
    if city_filter:
        base = base.where(Lender.city.ilike(f"%{city_filter}%"))

    stmt = base.order_by(Lender.name.asc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    result = []
    for r in rows:
        requests_raised = (await db.execute(
            select(func.count()).select_from(ReportRequest)
            .where(ReportRequest.lender_id == r.lender_id)
        )).scalar_one()

        reports_received = (await db.execute(
            select(func.count()).select_from(ReportRequest)
            .where(
                ReportRequest.lender_id == r.lender_id,
                ReportRequest.lender_status.in_(["RECEIVED", "ACCEPTED"]),
            )
        )).scalar_one()

        listings_purchased = (await db.execute(
            select(func.count()).select_from(ReportPurchase)
            .where(ReportPurchase.lender_id == r.lender_id)
        )).scalar_one()

        payable_stmt = select(
            func.coalesce(func.sum(LenderPayable.amount), Decimal("0")).label("total"),
            func.coalesce(
                func.sum(case((LenderPayable.status == "PAID", LenderPayable.amount))),
                Decimal("0"),
            ).label("paid"),
        ).where(LenderPayable.lender_id == r.lender_id)
        payable_row = (await db.execute(payable_stmt)).one()

        vendor_count = (await db.execute(
            select(func.count(distinct(RequestAcceptance.vendor_id)))
            .select_from(RequestAcceptance)
            .join(ReportRequest, ReportRequest.id == RequestAcceptance.request_id)
            .where(ReportRequest.lender_id == r.lender_id)
        )).scalar_one()

        result.append({
            "lender_id": str(r.lender_id),
            "lender_name": r.lender_name,
            "city": r.city,
            "requests_raised": requests_raised,
            "reports_received": reports_received,
            "listings_purchased": listings_purchased,
            "total_payable": str(payable_row.total),
            "total_paid": str(payable_row.paid),
            "vendor_count": vendor_count,
        })

    return result, total


async def get_admin_reports_table(
    db: AsyncSession,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    category_filter: str | None = None,
    property_type_filter: str | None = None,
    status_filter: str | None = None,
    vendor_filter: str | None = None,
    lender_filter: str | None = None,
    sort_by: str = "report_date",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    base = (
        select(
            Report.id.label("report_id"),
            Report.report_date,
            Vendor.name.label("vendor_name"),
            Report.property_address,
            Report.report_category,
            Report.property_type,
            Report.status,
            Report.valuation_amount,
        )
        .join(Vendor, Vendor.id == Report.vendor_id)
    )

    if category_filter:
        base = base.where(Report.report_category == category_filter)
    if property_type_filter:
        base = base.where(Report.property_type == property_type_filter)
    if status_filter:
        base = base.where(Report.status == status_filter)
    if date_from:
        base = base.where(Report.report_date >= date_from)
    if date_to:
        base = base.where(Report.report_date <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    sort_col = getattr(Report, sort_by, Report.report_date)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    result = []
    for r in rows:
        lender_name_stmt = (
            select(Lender.name)
            .select_from(RequestAcceptance)
            .join(ReportRequest, ReportRequest.id == RequestAcceptance.request_id)
            .join(Lender, Lender.id == ReportRequest.lender_id)
            .where(RequestAcceptance.report_id == r.report_id)
            .limit(1)
        )
        lender_name = (await db.execute(lender_name_stmt)).scalar_one_or_none()

        result.append({
            "report_id": str(r.report_id),
            "report_date": str(r.report_date) if r.report_date else None,
            "vendor_name": r.vendor_name,
            "lender_name": lender_name,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "property_type": r.property_type.value if r.property_type and hasattr(r.property_type, "value") else None,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "valuation_amount": str(r.valuation_amount) if r.valuation_amount else None,
        })

    return result, total


async def get_admin_open_requests(
    db: AsyncSession,
    *,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    base = (
        select(ReportRequest)
        .where(ReportRequest.lender_status.in_(["SENT", "AWAITED"]))
    )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    sort_col = getattr(ReportRequest, sort_by, ReportRequest.created_at)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = (
        select(
            ReportRequest.id.label("request_id"),
            Lender.name.label("lender_name"),
            ReportRequest.property_address,
            ReportRequest.report_category,
            ReportRequest.lender_status,
            ReportRequest.created_at,
            ReportRequest.eta_days,
            Vendor.name.label("vendor_name"),
            RequestBroadcast.broadcast_round,
        )
        .join(Lender, Lender.id == ReportRequest.lender_id)
        .outerjoin(RequestAcceptance, RequestAcceptance.request_id == ReportRequest.id)
        .outerjoin(Vendor, Vendor.id == RequestAcceptance.vendor_id)
        .outerjoin(
            RequestBroadcast,
            (RequestBroadcast.request_id == ReportRequest.id)
            & (RequestBroadcast.status == "ACTIVE"),
        )
        .where(ReportRequest.lender_status.in_(["SENT", "AWAITED"]))
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "request_id": str(r.request_id),
            "lender_name": r.lender_name,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "lender_status": r.lender_status.value if hasattr(r.lender_status, "value") else str(r.lender_status),
            "vendor_name": r.vendor_name,
            "created_at": r.created_at.isoformat(),
            "eta_days": r.eta_days,
            "broadcast_round": r.broadcast_round,
        }
        for r in rows
    ], total
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/dashboard_service.py
git commit -m "feat(phase7): add lender and admin dashboard service functions"
```

---

## Task 8: CSV Export Service

**Files:**
- Create: `backend/app/services/csv_export_service.py`

- [ ] **Step 1: Create `backend/app/services/csv_export_service.py`**

```python
import csv
import io
from collections.abc import Generator

from starlette.responses import StreamingResponse


def _generate_csv_rows(
    rows: list[dict], columns: list[tuple[str, str]]
) -> Generator[str, None, None]:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([col[0] for col in columns])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    for row in rows:
        writer.writerow([row.get(col[1], "") for col in columns])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)


def generate_csv_response(
    rows: list[dict],
    columns: list[tuple[str, str]],
    filename: str,
) -> StreamingResponse:
    return StreamingResponse(
        _generate_csv_rows(rows, columns),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/csv_export_service.py
git commit -m "feat(phase7): add CSV export service"
```

---

## Task 9: Vendor Dashboard API Router

**Files:**
- Create: `backend/app/api/vendor/dashboard.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/api/vendor/dashboard.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.dashboard import VendorDashboardStats, VendorReceivablesResponse, VendorEarningsResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api/vendor/dashboard", tags=["vendor-dashboard"])


async def _get_vendor_id(db: AsyncSession, user_id) -> str:
    from sqlalchemy import select
    stmt = select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    result = await db.execute(stmt)
    vendor_user = result.scalar_one_or_none()
    if not vendor_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_user


@router.get("/stats", response_model=VendorDashboardStats)
async def vendor_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_dashboard_stats(db, vendor_id=vendor_id)


@router.get("/receivables")
async def vendor_receivables(
    fy_year: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_receivables(db, vendor_id=vendor_id, fy_year=fy_year)


@router.get("/earnings")
async def vendor_earnings(
    fy_year: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_earnings_analytics(
        db, vendor_id=vendor_id, fy_year=fy_year, page=page, page_size=page_size
    )


@router.get("/pending-requests")
async def vendor_pending_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_pending_requests(db, vendor_id=vendor_id)


@router.get("/reports")
async def vendor_reports(
    search: str | None = Query(None),
    status: str | None = Query(None),
    category: str | None = Query(None),
    property_type: str | None = Query(None),
    sort_by: str = Query("report_date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    items, total = await dashboard_service.get_vendor_reports_table(
        db,
        vendor_id=vendor_id,
        search=search,
        status_filter=status,
        category_filter=category,
        property_type_filter=property_type,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
```

- [ ] **Step 2: Register router in `backend/app/main.py`**

Add import:

```python
from app.api.vendor.dashboard import router as vendor_dashboard_router
```

Add registration:

```python
app.include_router(vendor_dashboard_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/vendor/dashboard.py backend/app/main.py
git commit -m "feat(phase7): add vendor dashboard API endpoints"
```

---

## Task 10: Lender Dashboard API Router

**Files:**
- Create: `backend/app/api/lender/dashboard.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/api/lender/dashboard.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.lender import LenderUser
from app.models.user import User
from app.schemas.dashboard import LenderDashboardStats, LenderPayablesResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api/lender/dashboard", tags=["lender-dashboard"])


async def _get_lender_id(db: AsyncSession, user_id):
    from fastapi import HTTPException
    stmt = select(LenderUser.lender_id).where(LenderUser.user_id == user_id)
    result = await db.execute(stmt)
    lender_id = result.scalar_one_or_none()
    if not lender_id:
        raise HTTPException(status_code=404, detail="Lender not found")
    return lender_id


@router.get("/stats", response_model=LenderDashboardStats)
async def lender_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await dashboard_service.get_lender_dashboard_stats(db, lender_id=lender_id)


@router.get("/payables")
async def lender_payables(
    fy_year: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await dashboard_service.get_lender_payables_summary(
        db, lender_id=lender_id, fy_year=fy_year
    )


@router.get("/recent-requests")
async def lender_recent_requests(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await dashboard_service.get_lender_recent_requests(
        db, lender_id=lender_id, limit=limit
    )
```

- [ ] **Step 2: Register router in `backend/app/main.py`**

Add import:

```python
from app.api.lender.dashboard import router as lender_dashboard_router
```

Add registration:

```python
app.include_router(lender_dashboard_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/lender/dashboard.py backend/app/main.py
git commit -m "feat(phase7): add lender dashboard API endpoints"
```

---

## Task 11: Admin Dashboard API Router

**Files:**
- Create: `backend/app/api/admin/dashboard.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/api/admin/dashboard.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.schemas.dashboard import AdminDashboardStats
from app.services import dashboard_service
from app.services.csv_export_service import generate_csv_response

router = APIRouter(prefix="/api/admin/dashboard", tags=["admin-dashboard"])


@router.get("/stats", response_model=AdminDashboardStats)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    return await dashboard_service.get_admin_dashboard_stats(db)


@router.get("/vendors")
async def admin_vendors(
    city: str | None = Query(None),
    category: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    sort_by: str = Query("vendor_name"),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_vendors_table(
        db,
        city_filter=city,
        category_filter=category,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/vendors/export")
async def admin_vendors_export(
    city: str | None = Query(None),
    category: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, _ = await dashboard_service.get_admin_vendors_table(
        db, city_filter=city, category_filter=category,
        date_from=date_from, date_to=date_to, page=1, page_size=10000,
    )
    columns = [
        ("Vendor Name", "vendor_name"),
        ("City", "city"),
        ("Requests Served", "requests_served"),
        ("Reports Uploaded", "reports_uploaded"),
        ("Active Listings", "active_listings"),
        ("Downloads", "downloads"),
        ("Total Earnings", "total_earnings"),
        ("Lender Count", "lender_count"),
    ]
    return generate_csv_response(items, columns, "vendors_export.csv")


@router.get("/lenders")
async def admin_lenders(
    city: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    sort_by: str = Query("lender_name"),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_lenders_table(
        db,
        city_filter=city,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/lenders/export")
async def admin_lenders_export(
    city: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, _ = await dashboard_service.get_admin_lenders_table(
        db, city_filter=city, date_from=date_from, date_to=date_to,
        page=1, page_size=10000,
    )
    columns = [
        ("Lender Name", "lender_name"),
        ("City", "city"),
        ("Requests Raised", "requests_raised"),
        ("Reports Received", "reports_received"),
        ("Listings Purchased", "listings_purchased"),
        ("Total Payable", "total_payable"),
        ("Total Paid", "total_paid"),
        ("Vendor Count", "vendor_count"),
    ]
    return generate_csv_response(items, columns, "lenders_export.csv")


@router.get("/reports")
async def admin_reports(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    property_type: str | None = Query(None),
    status: str | None = Query(None),
    vendor: str | None = Query(None),
    lender: str | None = Query(None),
    sort_by: str = Query("report_date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_reports_table(
        db,
        date_from=date_from,
        date_to=date_to,
        category_filter=category,
        property_type_filter=property_type,
        status_filter=status,
        vendor_filter=vendor,
        lender_filter=lender,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/reports/export")
async def admin_reports_export(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    property_type: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, _ = await dashboard_service.get_admin_reports_table(
        db, date_from=date_from, date_to=date_to,
        category_filter=category, property_type_filter=property_type,
        status_filter=status, page=1, page_size=10000,
    )
    columns = [
        ("Report Date", "report_date"),
        ("Vendor", "vendor_name"),
        ("Lender", "lender_name"),
        ("Address", "property_address"),
        ("Category", "report_category"),
        ("Property Type", "property_type"),
        ("Status", "status"),
        ("Valuation Amount", "valuation_amount"),
    ]
    return generate_csv_response(items, columns, "reports_export.csv")


@router.get("/open-requests")
async def admin_open_requests(
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_open_requests(
        db, sort_by=sort_by, sort_order=sort_order, page=page, page_size=page_size
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
```

- [ ] **Step 2: Register router in `backend/app/main.py`**

Add import:

```python
from app.api.admin.dashboard import router as admin_dashboard_router
```

Add registration:

```python
app.include_router(admin_dashboard_router)
```

- [ ] **Step 3: Restart and verify**

```bash
docker compose -f docker-compose.local.yml restart backend
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/admin/dashboard.py backend/app/main.py
git commit -m "feat(phase7): add admin dashboard API endpoints with CSV export"
```

---

## Task 12: Frontend Types

**Files:**
- Create: `frontend/src/types/notification.ts`
- Create: `frontend/src/types/dashboard.ts`

- [ ] **Step 1: Create `frontend/src/types/notification.ts`**

```typescript
export interface Notification {
  id: string;
  user_id: string;
  event_type: "NEW_BROADCAST" | "REQUEST_ACCEPTED" | "REVISION_REQUESTED" | "LISTING_DOWNLOADED";
  title: string;
  message: string;
  reference_id: string;
  reference_type: "REQUEST" | "REPORT";
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  page_size: number;
}

export interface UnreadCountResponse {
  count: number;
}
```

- [ ] **Step 2: Create `frontend/src/types/dashboard.ts`**

```typescript
export interface VendorDashboardStats {
  requests_received: number;
  requests_accepted: number;
  reports_served: number;
  reports_listed: number;
  downloads: number;
  active_listings: number;
}

export interface LenderEarning {
  lender_id: string;
  lender_name: string;
  total_amount: string;
}

export interface MonthlyAmount {
  month: string;
  total_amount: string;
}

export interface VendorReceivablesResponse {
  lender_wise: LenderEarning[];
  month_wise: MonthlyAmount[];
}

export interface ReportEarning {
  report_id: string;
  property_address: string | null;
  report_category: string;
  total_amount: string;
}

export interface VendorEarningsResponse {
  lender_wise: LenderEarning[];
  report_wise: ReportEarning[];
  report_wise_total: number;
  month_wise: MonthlyAmount[];
}

export interface PendingRequestItem {
  id: string;
  lender_name: string;
  property_address: string | null;
  report_category: string;
  eta_days: number | null;
  price: string | null;
  vendor_status: string;
  accept_deadline: string | null;
  created_at: string;
}

export interface VendorReportItem {
  id: string;
  report_date: string | null;
  property_address: string | null;
  report_category: string;
  property_type: string | null;
  status: string;
  valuation_amount: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface LenderDashboardStats {
  requests_raised: number;
  awaiting_reports: number;
  reports_received: number;
  reports_accepted: number;
  listings_purchased: number;
}

export interface PayableSummaryTotals {
  pending: string;
  billed: string;
  paid: string;
}

export interface PayableTypeAmount {
  payable_type: string;
  total_amount: string;
}

export interface LenderPayablesResponse {
  totals: PayableSummaryTotals;
  month_wise: MonthlyAmount[];
  type_breakdown: PayableTypeAmount[];
}

export interface RecentRequestItem {
  id: string;
  property_address: string | null;
  report_category: string;
  lender_status: string;
  vendor_name: string | null;
  created_at: string;
}

export interface AdminDashboardStats {
  total_vendors: number;
  total_lenders: number;
  total_reports: number;
  total_revenue: string;
  pending_payables: string;
  open_requests: number;
}

export interface AdminVendorRow {
  vendor_id: string;
  vendor_name: string;
  city: string | null;
  requests_served: number;
  reports_uploaded: number;
  active_listings: number;
  downloads: number;
  total_earnings: string;
  lender_count: number;
}

export interface AdminLenderRow {
  lender_id: string;
  lender_name: string;
  city: string | null;
  requests_raised: number;
  reports_received: number;
  listings_purchased: number;
  total_payable: string;
  total_paid: string;
  vendor_count: number;
}

export interface AdminReportRow {
  report_id: string;
  report_date: string | null;
  vendor_name: string;
  lender_name: string | null;
  property_address: string | null;
  report_category: string;
  property_type: string | null;
  status: string;
  valuation_amount: string | null;
}

export interface AdminOpenRequestRow {
  request_id: string;
  lender_name: string;
  property_address: string | null;
  report_category: string;
  lender_status: string;
  vendor_name: string | null;
  created_at: string;
  eta_days: number | null;
  broadcast_round: number | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/notification.ts frontend/src/types/dashboard.ts
git commit -m "feat(phase7): add frontend types for notifications and dashboards"
```

---

## Task 13: Notification Bell Component & Hook

**Files:**
- Create: `frontend/src/hooks/use-notifications.ts`
- Create: `frontend/src/components/notification-bell.tsx`

- [ ] **Step 1: Create `frontend/src/hooks/use-notifications.ts`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Notification, NotificationListResponse, UnreadCountResponse } from "@/types/notification";

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.get<UnreadCountResponse>("/api/notifications/unread-count");
      setUnreadCount(data.count);
    } catch {
      // silently fail
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<NotificationListResponse>("/api/notifications?page_size=20");
      setNotifications(data.notifications);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/api/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
```

- [ ] **Step 2: Create `frontend/src/components/notification-bell.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getNotificationLink(referenceType: string, referenceId: string, userType: string): string {
  if (referenceType === "REQUEST") {
    return userType === "VENDOR"
      ? `/vendor/requests/${referenceId}`
      : `/lender/requests/${referenceId}`;
  }
  return userType === "VENDOR"
    ? `/vendor/reports`
    : `/lender/requests`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, notifications, loading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full-screen overlay */}
          <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-center text-gray-500">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-center text-gray-500">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <a
                    key={n.id}
                    href={getNotificationLink(n.reference_type, n.reference_id, user.user_type)}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false); }}
                    className={`block p-4 border-b hover:bg-gray-50 ${!n.is_read ? "bg-blue-50" : ""}`}
                  >
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </a>
                ))
              )}
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <div className="p-3 border-t">
                <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:text-blue-800 w-full text-center">
                  Mark all as read
                </button>
              </div>
            )}
          </div>

          {/* Desktop: dropdown */}
          <div className="hidden md:block absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border z-50 max-h-[480px] flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <p className="p-4 text-center text-gray-500 text-sm">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <a
                    key={n.id}
                    href={getNotificationLink(n.reference_type, n.reference_id, user.user_type)}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false); }}
                    className={`block px-4 py-3 border-b hover:bg-gray-50 ${!n.is_read ? "bg-blue-50" : ""}`}
                  >
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </a>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/use-notifications.ts frontend/src/components/notification-bell.tsx
git commit -m "feat(phase7): add notification bell component and hook"
```

---

## Task 14: Integrate NotificationBell into Layouts

**Files:**
- Modify: `frontend/src/app/vendor/layout.tsx`
- Modify: `frontend/src/app/lender/layout.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Add NotificationBell to vendor layout header**

In `frontend/src/app/vendor/layout.tsx`, add the import at the top:

```typescript
import { NotificationBell } from "@/components/notification-bell";
```

Then find the header area (the `div` containing the hamburger menu button) and add `<NotificationBell />` to the right side of the header bar, alongside the existing hamburger button. Place it in the top bar area so it's visible on all pages:

```typescript
<div className="flex items-center gap-2">
  <NotificationBell />
  {/* existing hamburger button */}
</div>
```

- [ ] **Step 2: Add NotificationBell to lender layout header**

Same pattern in `frontend/src/app/lender/layout.tsx`:

```typescript
import { NotificationBell } from "@/components/notification-bell";
```

Add `<NotificationBell />` to the header bar.

- [ ] **Step 3: Add NotificationBell to admin layout header**

Same pattern in `frontend/src/app/admin/layout.tsx`:

```typescript
import { NotificationBell } from "@/components/notification-bell";
```

Add `<NotificationBell />` to the header bar.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/vendor/layout.tsx frontend/src/app/lender/layout.tsx frontend/src/app/admin/layout.tsx
git commit -m "feat(phase7): integrate notification bell into all portal layouts"
```

---

## Task 15: Shared Dashboard Components

**Files:**
- Create: `frontend/src/components/metric-card.tsx`
- Create: `frontend/src/components/date-range-filter.tsx`

- [ ] **Step 1: Create `frontend/src/components/metric-card.tsx`**

```typescript
import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
}

export function MetricCard({ label, value, icon: Icon, color = "text-blue-600" }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-4 min-w-[160px]">
      <div className={`p-3 rounded-lg bg-gray-50 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/date-range-filter.tsx`**

```typescript
"use client";

interface DateRangeFilterProps {
  selectedYear: number;
  onChange: (year: number) => void;
}

function getFYOptions(): { label: string; value: number }[] {
  const now = new Date();
  const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let y = currentFY; y >= currentFY - 2; y--) {
    options.push({
      label: `FY ${y}-${(y + 1).toString().slice(2)}`,
      value: y,
    });
  }
  return options;
}

export function DateRangeFilter({ selectedYear, onChange }: DateRangeFilterProps) {
  const options = getFYOptions();

  return (
    <select
      value={selectedYear}
      onChange={(e) => onChange(Number(e.target.value))}
      className="border rounded-lg px-3 py-2 text-sm bg-white"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/metric-card.tsx frontend/src/components/date-range-filter.tsx
git commit -m "feat(phase7): add shared metric card and date range filter components"
```

---

## Task 16: Vendor Dashboard Page

**Files:**
- Create: `frontend/src/app/vendor/dashboard/_components/vendor-stats.tsx`
- Create: `frontend/src/app/vendor/dashboard/_components/receivables-section.tsx`
- Create: `frontend/src/app/vendor/dashboard/_components/earnings-charts.tsx`
- Create: `frontend/src/app/vendor/dashboard/_components/pending-requests-table.tsx`
- Create: `frontend/src/app/vendor/dashboard/_components/reports-table.tsx`
- Modify: `frontend/src/app/vendor/dashboard/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/vendor/dashboard/_components/vendor-stats.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { FileText, Download, List, CheckCircle, Inbox, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { VendorDashboardStats } from "@/types/dashboard";

export function VendorStats() {
  const [stats, setStats] = useState<VendorDashboardStats | null>(null);

  useEffect(() => {
    api.get<VendorDashboardStats>("/api/vendor/dashboard/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard label="Requests Received" value={stats.requests_received} icon={Inbox} color="text-blue-600" />
      <MetricCard label="Requests Accepted" value={stats.requests_accepted} icon={CheckCircle} color="text-green-600" />
      <MetricCard label="Reports Served" value={stats.reports_served} icon={FileText} color="text-purple-600" />
      <MetricCard label="Reports Listed" value={stats.reports_listed} icon={List} color="text-indigo-600" />
      <MetricCard label="Downloads" value={stats.downloads} icon={Download} color="text-orange-600" />
      <MetricCard label="Active Listings" value={stats.active_listings} icon={BarChart3} color="text-teal-600" />
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/vendor/dashboard/_components/receivables-section.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { VendorReceivablesResponse } from "@/types/dashboard";

interface Props {
  fyYear: number;
}

export function ReceivablesSection({ fyYear }: Props) {
  const [data, setData] = useState<VendorReceivablesResponse | null>(null);

  useEffect(() => {
    api.get<VendorReceivablesResponse>(`/api/vendor/dashboard/receivables?fy_year=${fyYear}`)
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

  if (!data) {
    return <div className="bg-white rounded-lg border p-6 h-48 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="font-semibold text-lg mb-4">Receivables</h3>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-500 mb-2">By Lender</h4>
        {data.lender_wise.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Lender</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.lender_wise.map((row) => (
                  <tr key={row.lender_id} className="border-b">
                    <td className="py-2">{row.lender_name}</td>
                    <td className="text-right py-2 font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-2">Month-wise</h4>
        {data.month_wise.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.month_wise.map((row) => (
                  <tr key={row.month} className="border-b">
                    <td className="py-2">{row.month}</td>
                    <td className="text-right py-2 font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/vendor/dashboard/_components/earnings-charts.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { VendorEarningsResponse } from "@/types/dashboard";

interface Props {
  fyYear: number;
}

export function EarningsCharts({ fyYear }: Props) {
  const [data, setData] = useState<VendorEarningsResponse | null>(null);
  const [reportPage, setReportPage] = useState(1);

  useEffect(() => {
    api.get<VendorEarningsResponse>(
      `/api/vendor/dashboard/earnings?fy_year=${fyYear}&page=${reportPage}&page_size=10`
    )
      .then(setData)
      .catch(() => {});
  }, [fyYear, reportPage]);

  if (!data) {
    return <div className="bg-white rounded-lg border p-6 h-64 animate-pulse" />;
  }

  const lenderChartData = data.lender_wise.map((r) => ({
    name: r.lender_name,
    amount: parseFloat(r.total_amount),
  }));

  const monthChartData = data.month_wise.map((r) => ({
    name: r.month,
    amount: parseFloat(r.total_amount),
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-lg mb-4">Earnings by Lender</h3>
        {lenderChartData.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lenderChartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `₹${v.toLocaleString()}`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Earnings"]} />
              <Bar dataKey="amount" fill="#4f46e5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-lg mb-4">Monthly Earnings</h3>
        {monthChartData.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${v.toLocaleString()}`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Earnings"]} />
              <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-lg mb-4">Top Reports by Earnings</h3>
        {data.report_wise.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Address</th>
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.report_wise.map((r) => (
                    <tr key={r.report_id} className="border-b hover:bg-gray-50">
                      <td className="py-2">{r.property_address || "—"}</td>
                      <td className="py-2">{r.report_category}</td>
                      <td className="text-right py-2 font-medium">₹{parseFloat(r.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                disabled={reportPage === 1}
                className="text-sm text-blue-600 disabled:text-gray-400"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {reportPage}</span>
              <button
                onClick={() => setReportPage((p) => p + 1)}
                disabled={data.report_wise.length < 10}
                className="text-sm text-blue-600 disabled:text-gray-400"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/app/vendor/dashboard/_components/pending-requests-table.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PendingRequestItem } from "@/types/dashboard";

function timeRemaining(deadline: string | null): string {
  if (!deadline) return "—";
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

export function PendingRequestsTable() {
  const [requests, setRequests] = useState<PendingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PendingRequestItem[]>("/api/vendor/dashboard/pending-requests")
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6 h-32 animate-pulse" />;
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
      <h3 className="font-semibold text-lg mb-4 text-yellow-800">Pending Requests</h3>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-yellow-200">
              <th className="text-left py-2">Lender</th>
              <th className="text-left py-2">Address</th>
              <th className="text-left py-2">Category</th>
              <th className="text-right py-2">ETA</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Time Left</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-yellow-100 hover:bg-yellow-100">
                <td className="py-2">
                  <Link href={`/vendor/requests/${r.id}`} className="text-blue-600 hover:underline">
                    {r.lender_name}
                  </Link>
                </td>
                <td className="py-2">{r.property_address || "—"}</td>
                <td className="py-2">{r.report_category}</td>
                <td className="text-right py-2">{r.eta_days ? `${r.eta_days}d` : "—"}</td>
                <td className="text-right py-2">{r.price ? `₹${parseFloat(r.price).toLocaleString()}` : "—"}</td>
                <td className="text-right py-2 font-medium">{timeRemaining(r.accept_deadline)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map((r) => (
          <Link key={r.id} href={`/vendor/requests/${r.id}`} className="block bg-white rounded-lg p-4 border border-yellow-200">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium">{r.lender_name}</span>
              <span className="text-sm font-medium text-yellow-700">{timeRemaining(r.accept_deadline)}</span>
            </div>
            <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>{r.report_category}</span>
              {r.price && <span>₹{parseFloat(r.price).toLocaleString()}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/app/vendor/dashboard/_components/reports-table.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { PaginatedResponse, VendorReportItem } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export function ReportsTable() {
  const [items, setItems] = useState<VendorReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const data = await api.get<PaginatedResponse<VendorReportItem>>(
        `/api/vendor/dashboard/reports?${params}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="font-semibold text-lg mb-4">Reports</h3>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search address or applicant..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Statuses</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="PROCESSING">Processing</option>
          <option value="READY_TO_PUBLISH">Ready to Publish</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse bg-gray-50 rounded" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No reports found</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Valuation</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{r.report_date || "—"}</td>
                    <td className="py-2">
                      <Link href={`/vendor/reports`} className="text-blue-600 hover:underline">
                        {r.property_address || "—"}
                      </Link>
                    </td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">{r.property_type || "—"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="text-right py-2">
                      {r.valuation_amount ? `₹${parseFloat(r.valuation_amount).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">{r.property_address || "—"}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>
                    {r.status}
                  </span>
                </div>
                <div className="flex gap-3 text-sm text-gray-500">
                  <span>{r.report_category}</span>
                  <span>{r.report_date || "—"}</span>
                  {r.valuation_amount && <span>₹{parseFloat(r.valuation_amount).toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace `frontend/src/app/vendor/dashboard/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { VendorStats } from "./_components/vendor-stats";
import { ReceivablesSection } from "./_components/receivables-section";
import { EarningsCharts } from "./_components/earnings-charts";
import { PendingRequestsTable } from "./_components/pending-requests-table";
import { ReportsTable } from "./_components/reports-table";

function getCurrentFY(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function VendorDashboardPage() {
  const [fyYear, setFyYear] = useState(getCurrentFY());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <DateRangeFilter selectedYear={fyYear} onChange={setFyYear} />
          <Link
            href="/vendor/reports/bulk-upload"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Upload Reports
          </Link>
        </div>
      </div>

      <VendorStats />
      <PendingRequestsTable />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReceivablesSection fyYear={fyYear} />
        <div /> {/* spacer for layout */}
      </div>

      <EarningsCharts fyYear={fyYear} />
      <ReportsTable />
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/vendor/dashboard/
git commit -m "feat(phase7): build vendor dashboard with stats, charts, and tables"
```

---

## Task 17: Lender Dashboard Page

**Files:**
- Create: `frontend/src/app/lender/dashboard/_components/lender-stats.tsx`
- Create: `frontend/src/app/lender/dashboard/_components/payables-section.tsx`
- Create: `frontend/src/app/lender/dashboard/_components/recent-requests-table.tsx`
- Modify: `frontend/src/app/lender/dashboard/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/lender/dashboard/_components/lender-stats.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle, ShoppingCart, Send } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { LenderDashboardStats } from "@/types/dashboard";

export function LenderStats() {
  const [stats, setStats] = useState<LenderDashboardStats | null>(null);

  useEffect(() => {
    api.get<LenderDashboardStats>("/api/lender/dashboard/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <MetricCard label="Requests Raised" value={stats.requests_raised} icon={Send} color="text-blue-600" />
      <MetricCard label="Awaiting Reports" value={stats.awaiting_reports} icon={Clock} color="text-yellow-600" />
      <MetricCard label="Reports Received" value={stats.reports_received} icon={FileText} color="text-purple-600" />
      <MetricCard label="Reports Accepted" value={stats.reports_accepted} icon={CheckCircle} color="text-green-600" />
      <MetricCard label="Listings Purchased" value={stats.listings_purchased} icon={ShoppingCart} color="text-orange-600" />
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/lender/dashboard/_components/payables-section.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { LenderPayablesResponse } from "@/types/dashboard";

interface Props {
  fyYear: number;
}

const PIE_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626"];

export function PayablesSection({ fyYear }: Props) {
  const [data, setData] = useState<LenderPayablesResponse | null>(null);

  useEffect(() => {
    api.get<LenderPayablesResponse>(`/api/lender/dashboard/payables?fy_year=${fyYear}`)
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

  if (!data) {
    return <div className="bg-white rounded-lg border p-6 h-64 animate-pulse" />;
  }

  const pieData = data.type_breakdown.map((t) => ({
    name: t.payable_type.replace(/_/g, " "),
    value: parseFloat(t.total_amount),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-2xl font-bold text-yellow-800">₹{parseFloat(data.totals.pending).toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Billed</p>
          <p className="text-2xl font-bold text-blue-800">₹{parseFloat(data.totals.billed).toLocaleString()}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">Paid</p>
          <p className="text-2xl font-bold text-green-800">₹{parseFloat(data.totals.paid).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-4">Month-wise Breakdown</h4>
          {data.month_wise.length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Month</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.month_wise.map((row) => (
                    <tr key={row.month} className="border-b">
                      <td className="py-2">{row.month}</td>
                      <td className="text-right py-2 font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-4">By Type</h4>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/lender/dashboard/_components/recent-requests-table.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RecentRequestItem } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  AWAITED: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-purple-100 text-purple-700",
  ACCEPTED: "bg-green-100 text-green-700",
  SENT_FOR_REVIEW: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
};

export function RecentRequestsTable() {
  const [requests, setRequests] = useState<RecentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RecentRequestItem[]>("/api/lender/dashboard/recent-requests")
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="bg-white rounded-lg border p-6 h-48 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Recent Requests</h3>
        <Link href="/lender/requests" className="text-sm text-blue-600 hover:text-blue-800">
          View all →
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No requests yet</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/lender/requests/${r.id}`} className="text-blue-600 hover:underline">
                        {r.property_address || "—"}
                      </Link>
                    </td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>
                        {r.lender_status}
                      </span>
                    </td>
                    <td className="py-2">{r.vendor_name || "—"}</td>
                    <td className="py-2 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {requests.map((r) => (
              <Link key={r.id} href={`/lender/requests/${r.id}`} className="block border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">{r.property_address || "—"}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>
                    {r.lender_status}
                  </span>
                </div>
                <div className="flex gap-3 text-sm text-gray-500">
                  <span>{r.report_category}</span>
                  <span>{r.vendor_name || "Unassigned"}</span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace `frontend/src/app/lender/dashboard/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { LenderStats } from "./_components/lender-stats";
import { PayablesSection } from "./_components/payables-section";
import { RecentRequestsTable } from "./_components/recent-requests-table";

function getCurrentFY(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function LenderDashboardPage() {
  const [fyYear, setFyYear] = useState(getCurrentFY());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <DateRangeFilter selectedYear={fyYear} onChange={setFyYear} />
          <Link
            href="/lender/requests/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Raise Request
          </Link>
        </div>
      </div>

      <LenderStats />
      <PayablesSection fyYear={fyYear} />
      <RecentRequestsTable />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lender/dashboard/
git commit -m "feat(phase7): build lender dashboard with stats, payables, and recent requests"
```

---

## Task 18: Admin Dashboard Page

**Files:**
- Create: `frontend/src/app/admin/dashboard/_components/admin-stats.tsx`
- Create: `frontend/src/app/admin/dashboard/_components/vendors-tab.tsx`
- Create: `frontend/src/app/admin/dashboard/_components/lenders-tab.tsx`
- Create: `frontend/src/app/admin/dashboard/_components/reports-tab.tsx`
- Create: `frontend/src/app/admin/dashboard/_components/open-requests-tab.tsx`
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/admin/dashboard/_components/admin-stats.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Users, Building2, FileText, DollarSign, Clock, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { AdminDashboardStats } from "@/types/dashboard";

export function AdminStats() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    api.get<AdminDashboardStats>("/api/admin/dashboard/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard label="Total Vendors" value={stats.total_vendors} icon={Building2} color="text-blue-600" />
      <MetricCard label="Total Lenders" value={stats.total_lenders} icon={Users} color="text-green-600" />
      <MetricCard label="Total Reports" value={stats.total_reports} icon={FileText} color="text-purple-600" />
      <MetricCard label="Total Revenue" value={`₹${parseFloat(stats.total_revenue).toLocaleString()}`} icon={DollarSign} color="text-emerald-600" />
      <MetricCard label="Pending Payables" value={`₹${parseFloat(stats.pending_payables).toLocaleString()}`} icon={Clock} color="text-yellow-600" />
      <MetricCard label="Open Requests" value={stats.open_requests} icon={AlertCircle} color="text-red-600" />
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/admin/dashboard/_components/vendors-tab.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { AdminVendorRow, PaginatedResponse } from "@/types/dashboard";

export function VendorsTab() {
  const [items, setItems] = useState<AdminVendorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (cityFilter) params.set("city", cityFilter);
      const data = await api.get<PaginatedResponse<AdminVendorRow>>(`/api/admin/dashboard/vendors?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page, cityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (cityFilter) params.set("city", cityFilter);
    const token = localStorage.getItem("access_token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/admin/dashboard/vendors/export?${params}`;
    window.open(`${url}&token=${token}`, "_blank");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by city..."
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64"
        />
        <button onClick={handleExport} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">City</th>
                  <th className="text-right py-2">Requests</th>
                  <th className="text-right py-2">Reports</th>
                  <th className="text-right py-2">Listings</th>
                  <th className="text-right py-2">Downloads</th>
                  <th className="text-right py-2">Earnings</th>
                  <th className="text-right py-2">Lenders</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.vendor_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.vendor_name}</td>
                    <td className="py-2">{r.city || "—"}</td>
                    <td className="text-right py-2">{r.requests_served}</td>
                    <td className="text-right py-2">{r.reports_uploaded}</td>
                    <td className="text-right py-2">{r.active_listings}</td>
                    <td className="text-right py-2">{r.downloads}</td>
                    <td className="text-right py-2">₹{parseFloat(r.total_earnings).toLocaleString()}</td>
                    <td className="text-right py-2">{r.lender_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.vendor_id} className="border rounded-lg p-4">
                <p className="font-medium">{r.vendor_name}</p>
                <p className="text-sm text-gray-500">{r.city || "—"}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <span>Requests: {r.requests_served}</span>
                  <span>Reports: {r.reports_uploaded}</span>
                  <span>Downloads: {r.downloads}</span>
                  <span>Earnings: ₹{parseFloat(r.total_earnings).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/admin/dashboard/_components/lenders-tab.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { AdminLenderRow, PaginatedResponse } from "@/types/dashboard";

export function LendersTab() {
  const [items, setItems] = useState<AdminLenderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (cityFilter) params.set("city", cityFilter);
      const data = await api.get<PaginatedResponse<AdminLenderRow>>(`/api/admin/dashboard/lenders?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page, cityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (cityFilter) params.set("city", cityFilter);
    const token = localStorage.getItem("access_token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/admin/dashboard/lenders/export?${params}`;
    window.open(`${url}&token=${token}`, "_blank");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by city..."
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64"
        />
        <button onClick={handleExport} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Lender</th>
                  <th className="text-left py-2">City</th>
                  <th className="text-right py-2">Requests</th>
                  <th className="text-right py-2">Reports</th>
                  <th className="text-right py-2">Purchases</th>
                  <th className="text-right py-2">Total Payable</th>
                  <th className="text-right py-2">Total Paid</th>
                  <th className="text-right py-2">Vendors</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.lender_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.lender_name}</td>
                    <td className="py-2">{r.city || "—"}</td>
                    <td className="text-right py-2">{r.requests_raised}</td>
                    <td className="text-right py-2">{r.reports_received}</td>
                    <td className="text-right py-2">{r.listings_purchased}</td>
                    <td className="text-right py-2">₹{parseFloat(r.total_payable).toLocaleString()}</td>
                    <td className="text-right py-2">₹{parseFloat(r.total_paid).toLocaleString()}</td>
                    <td className="text-right py-2">{r.vendor_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.lender_id} className="border rounded-lg p-4">
                <p className="font-medium">{r.lender_name}</p>
                <p className="text-sm text-gray-500">{r.city || "—"}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <span>Requests: {r.requests_raised}</span>
                  <span>Reports: {r.reports_received}</span>
                  <span>Payable: ₹{parseFloat(r.total_payable).toLocaleString()}</span>
                  <span>Paid: ₹{parseFloat(r.total_paid).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/app/admin/dashboard/_components/reports-tab.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { AdminReportRow, PaginatedResponse } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export function ReportsTab() {
  const [items, setItems] = useState<AdminReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      const data = await api.get<PaginatedResponse<AdminReportRow>>(`/api/admin/dashboard/reports?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page, categoryFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    const token = localStorage.getItem("access_token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/admin/dashboard/reports/export?${params}`;
    window.open(`${url}&token=${token}`, "_blank");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex gap-3">
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Categories</option>
            <option value="VALUATION">Valuation</option>
            <option value="LEGAL">Legal</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Statuses</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="PROCESSING">Processing</option>
            <option value="READY_TO_PUBLISH">Ready to Publish</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded" />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">Lender</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Valuation</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.report_id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{r.report_date || "—"}</td>
                    <td className="py-2">{r.vendor_name}</td>
                    <td className="py-2">{r.lender_name || "—"}</td>
                    <td className="py-2">{r.property_address || "—"}</td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status}</span>
                    </td>
                    <td className="text-right py-2">{r.valuation_amount ? `₹${parseFloat(r.valuation_amount).toLocaleString()}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.report_id} className="border rounded-lg p-4">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-sm">{r.vendor_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status}</span>
                </div>
                <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
                <div className="flex gap-3 text-sm text-gray-500 mt-1">
                  <span>{r.report_category}</span>
                  <span>{r.report_date || "—"}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/app/admin/dashboard/_components/open-requests-tab.tsx`**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AdminOpenRequestRow, PaginatedResponse } from "@/types/dashboard";

function etaCountdown(createdAt: string, etaDays: number | null): string {
  if (!etaDays) return "—";
  const created = new Date(createdAt);
  const deadline = new Date(created.getTime() + etaDays * 86400000);
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "Overdue";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-700",
  AWAITED: "bg-yellow-100 text-yellow-700",
};

export function OpenRequestsTab() {
  const [items, setItems] = useState<AdminOpenRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      const data = await api.get<PaginatedResponse<AdminOpenRequestRow>>(`/api/admin/dashboard/open-requests?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div>
      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No open requests</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Lender</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">Created</th>
                  <th className="text-right py-2">ETA</th>
                  <th className="text-right py-2">Round</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.request_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.lender_name}</td>
                    <td className="py-2">{r.property_address || "—"}</td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>{r.lender_status}</span>
                    </td>
                    <td className="py-2">{r.vendor_name || "Unassigned"}</td>
                    <td className="py-2 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="text-right py-2 font-medium">{etaCountdown(r.created_at, r.eta_days)}</td>
                    <td className="text-right py-2">{r.broadcast_round || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.request_id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">{r.lender_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>{r.lender_status}</span>
                </div>
                <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
                <div className="flex gap-3 text-sm text-gray-500 mt-1">
                  <span>{r.vendor_name || "Unassigned"}</span>
                  <span>ETA: {etaCountdown(r.created_at, r.eta_days)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace `frontend/src/app/admin/dashboard/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { AdminStats } from "./_components/admin-stats";
import { VendorsTab } from "./_components/vendors-tab";
import { LendersTab } from "./_components/lenders-tab";
import { ReportsTab } from "./_components/reports-tab";
import { OpenRequestsTab } from "./_components/open-requests-tab";

const TABS = [
  { key: "vendors", label: "Vendors" },
  { key: "lenders", label: "Lenders" },
  { key: "reports", label: "Reports" },
  { key: "open-requests", label: "Open Requests" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("vendors");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <AdminStats />

      {/* Desktop tabs */}
      <div className="hidden md:block">
        <div className="border-b">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-xs font-medium text-center ${
                activeTab === tab.key ? "text-blue-600 border-t-2 border-blue-600" : "text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-16 md:pb-0">
        {activeTab === "vendors" && <VendorsTab />}
        {activeTab === "lenders" && <LendersTab />}
        {activeTab === "reports" && <ReportsTab />}
        {activeTab === "open-requests" && <OpenRequestsTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/admin/dashboard/
git commit -m "feat(phase7): build admin dashboard with tabs, tables, and CSV export"
```

---

## Task 19: Wire Notification Creation into Existing Services

**Files:**
- Modify: `backend/app/services/broadcast_service.py`
- Modify: `backend/app/services/request_service.py`
- Modify: `backend/app/services/report_service.py`
- Modify: `backend/app/services/listing_service.py`

- [ ] **Step 1: Wire NEW_BROADCAST notifications in `broadcast_service.py`**

After a broadcast is created (after `db.flush()` in the broadcast creation flow), add notification creation for each vendor user. Import the needed modules:

```python
from sqlalchemy import select
from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.vendor import VendorUser
from app.services import notification_service
```

After the broadcast is flushed/created, loop through vendor_ids and create notifications:

```python
for vid in vendor_ids:
    vendor_users_stmt = select(VendorUser.user_id).where(VendorUser.vendor_id == vid)
    vendor_user_ids = (await db.execute(vendor_users_stmt)).scalars().all()
    for user_id in vendor_user_ids:
        await notification_service.create_notification(
            db,
            user_id=user_id,
            event_type=NotificationEventType.NEW_BROADCAST,
            title=f"New request from {lender_name}",
            message=f"{report_category} report request for {property_address or 'a property'}",
            reference_id=request_id,
            reference_type=NotificationReferenceType.REQUEST,
        )
```

Adapt variable names (`lender_name`, `report_category`, `property_address`, `request_id`) to match what's available in the function scope. Read the actual function to identify the right insertion point and available variables.

- [ ] **Step 2: Wire REQUEST_ACCEPTED notifications in `request_service.py`**

After a vendor's acceptance is confirmed, notify the vendor's users:

```python
from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.vendor import VendorUser
from app.services import notification_service

# After acceptance is confirmed:
vendor_users_stmt = select(VendorUser.user_id).where(VendorUser.vendor_id == vendor_id)
vendor_user_ids = (await db.execute(vendor_users_stmt)).scalars().all()
for user_id in vendor_user_ids:
    await notification_service.create_notification(
        db,
        user_id=user_id,
        event_type=NotificationEventType.REQUEST_ACCEPTED,
        title="Request accepted",
        message=f"Your acceptance for the {report_category} request has been confirmed",
        reference_id=request_id,
        reference_type=NotificationReferenceType.REQUEST,
    )
```

- [ ] **Step 3: Wire REVISION_REQUESTED notifications in `report_service.py`**

When a revision is requested on a report, notify the vendor:

```python
from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.vendor import VendorUser
from app.services import notification_service

# After revision is created:
vendor_users_stmt = select(VendorUser.user_id).where(VendorUser.vendor_id == report.vendor_id)
vendor_user_ids = (await db.execute(vendor_users_stmt)).scalars().all()
for user_id in vendor_user_ids:
    await notification_service.create_notification(
        db,
        user_id=user_id,
        event_type=NotificationEventType.REVISION_REQUESTED,
        title="Revision requested",
        message=f"A revision has been requested for the report at {report.property_address or 'a property'}",
        reference_id=report.id,
        reference_type=NotificationReferenceType.REPORT,
    )
```

- [ ] **Step 4: Wire LISTING_DOWNLOADED notifications in `listing_service.py`**

When a lender purchases a listing report, notify the vendor:

```python
from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.vendor import VendorUser
from app.services import notification_service

# After purchase is created:
vendor_users_stmt = select(VendorUser.user_id).where(VendorUser.vendor_id == report.vendor_id)
vendor_user_ids = (await db.execute(vendor_users_stmt)).scalars().all()
for user_id in vendor_user_ids:
    await notification_service.create_notification(
        db,
        user_id=user_id,
        event_type=NotificationEventType.LISTING_DOWNLOADED,
        title="Report downloaded",
        message=f"A lender has purchased your report for {report.property_address or 'a property'}",
        reference_id=report.id,
        reference_type=NotificationReferenceType.REPORT,
    )
```

- [ ] **Step 5: Restart backend and verify**

```bash
docker compose -f docker-compose.local.yml restart backend
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/broadcast_service.py backend/app/services/request_service.py backend/app/services/report_service.py backend/app/services/listing_service.py
git commit -m "feat(phase7): wire notification creation into broadcast, request, report, and listing services"
```

---

## Task 20: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Phase 7 status in CLAUDE.md**

Update the Current Status section to add Phase 7 as complete:

```markdown
**Phase 7 (Dashboards & Analytics):** Complete — Notification model + service + API (4 endpoints), notification bell component (all portals), dashboard service (13 aggregation functions), vendor dashboard (6 widgets + receivables + earnings charts + pending requests + reports table), lender dashboard (5 widgets + payables summary + pie chart + recent requests), admin dashboard (6 widgets + 4 tabs: vendors/lenders/reports/open-requests + CSV export), financial year filtering, responsive design
```

Add new key files:

```markdown
- `backend/app/models/notification.py` — Notification model (events, read state)
- `backend/app/services/notification_service.py` — Notification CRUD + unread count
- `backend/app/services/dashboard_service.py` — Aggregation queries for all dashboards
- `backend/app/services/csv_export_service.py` — Streaming CSV response generator
- `backend/app/api/notifications.py` — Notification endpoints (list, unread count, mark read)
- `backend/app/api/vendor/dashboard.py` — Vendor dashboard endpoints (5)
- `backend/app/api/lender/dashboard.py` — Lender dashboard endpoints (3)
- `backend/app/api/admin/dashboard.py` — Admin dashboard endpoints (8, incl. 3 CSV exports)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Phase 7 completion status"
```
