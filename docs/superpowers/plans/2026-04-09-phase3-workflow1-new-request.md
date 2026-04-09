# Phase 3: Workflow 1 — New Report Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end flow from lender creating a report request, through vendor broadcast/acceptance, to report upload, review, acceptance, billing, and listing creation.

**Architecture:** Service-per-domain pattern matching existing codebase. Four new backend services (request, broadcast, report, billing), four new API routers, two Celery jobs, and five new frontend pages across lender/vendor portals. Polling-based notifications (30s interval) instead of WebSocket.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Celery, Next.js 15 App Router, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-09-phase3-workflow1-new-request-design.md`

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `app/core/constants.py` | Broadcast, upload, polling constants |
| `app/services/billing_service.py` | Create VendorEarning + LenderPayable entries |
| `app/services/broadcast_service.py` | Vendor selection, broadcast rounds, accept/reject |
| `app/services/report_service.py` | Report upload, revision, download |
| `app/services/request_service.py` | Request lifecycle, orchestrates other services |
| `app/api/lender/requests.py` | 6 lender request endpoints |
| `app/api/vendor/requests.py` | 6 vendor request endpoints |
| `app/api/common/polling.py` | Polling endpoint |
| `app/api/common/download.py` | Auth-checked report download |
| `app/jobs/auto_accept.py` | Daily auto-accept Celery task |
| `app/jobs/broadcast_tasks.py` | Broadcast rotation Celery task |
| `app/schemas/broadcast.py` | Broadcast + rejection schemas |
| `app/schemas/polling.py` | Polling response schema |

### Backend — Modified Files
| File | Change |
|------|--------|
| `app/schemas/request.py` | Add `ReportRequestCreateInput`, `ReportRequestDetail`, `EligibleVendorResponse` |
| `app/schemas/report.py` | Add `ReportUploadMeta`, `RevisionSummary`, `ReportDetail` |
| `app/main.py` | Register 4 new routers |
| `app/jobs/celery_app.py` | Fix broadcast task import path if needed |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `src/types/request.ts` | Request, create, filter, vendor types |
| `src/types/report.ts` | Report and revision types |
| `src/types/broadcast.ts` | Broadcast info type |
| `src/hooks/use-polling.ts` | Polling hook with visibility API |
| `src/app/lender/requests/page.tsx` | Request list with tabs |
| `src/app/lender/requests/_components/request-table.tsx` | Table + card components |
| `src/app/lender/requests/new/page.tsx` | Multi-step request form |
| `src/app/lender/requests/new/_components/property-form.tsx` | Step 1 form |
| `src/app/lender/requests/new/_components/report-config-form.tsx` | Step 2 form |
| `src/app/lender/requests/new/_components/price-confirmation.tsx` | Step 3 confirm |
| `src/app/lender/requests/[id]/page.tsx` | Request detail + actions |
| `src/app/lender/requests/[id]/_components/status-timeline.tsx` | Timeline component |
| `src/app/vendor/requests/page.tsx` | Vendor request list with tabs |
| `src/app/vendor/requests/_components/request-table.tsx` | Table + card components |
| `src/app/vendor/requests/[id]/page.tsx` | Request detail + actions |
| `src/app/vendor/requests/[id]/_components/upload-section.tsx` | PDF upload component |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `src/lib/api.ts` | Add `upload` method for multipart/form-data |
| `src/app/lender/layout.tsx` | Add "Requests" nav item |
| `src/app/vendor/layout.tsx` | Add "Requests" nav item |

### Test Files
| File | Tests |
|------|-------|
| `backend/tests/services/test_billing_service.py` | Billing entry creation |
| `backend/tests/services/test_broadcast_service.py` | Vendor selection, rounds, accept/reject |
| `backend/tests/services/test_report_service.py` | Upload, revision, download auth |
| `backend/tests/services/test_request_service.py` | Full request lifecycle |
| `backend/tests/api/test_lender_requests.py` | Lender API integration tests |
| `backend/tests/api/test_vendor_requests.py` | Vendor API integration tests |

---

## Task 1: Constants Module

**Files:**
- Create: `backend/app/core/constants.py`

- [ ] **Step 1: Create constants file**

```python
# backend/app/core/constants.py

# Broadcast configuration
VENDORS_PER_BROADCAST_ROUND = 5
BROADCAST_ACCEPT_WINDOW_MINUTES = 30

# Auto-accept
AUTO_ACCEPT_DAYS = 7

# Polling
POLL_INTERVAL_SECONDS = 30

# File upload
MEDIA_ROOT = "/app/media"
REPORTS_DIR = "reports"
MAX_UPLOAD_SIZE_MB = 20
ALLOWED_CONTENT_TYPES = ["application/pdf"]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/constants.py
git commit -m "feat: add Phase 3 constants for broadcast, upload, polling"
```

---

## Task 2: Extend Pydantic Schemas

**Files:**
- Modify: `backend/app/schemas/request.py`
- Modify: `backend/app/schemas/report.py`
- Create: `backend/app/schemas/broadcast.py`
- Create: `backend/app/schemas/polling.py`

- [ ] **Step 1: Extend request schemas**

Replace the entire `backend/app/schemas/request.py` with:

```python
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReportRequestCreate(BaseModel):
    """Used internally / by admin — preserves Phase 2 schema."""
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


class ReportRequestCreateInput(BaseModel):
    """Lender form input for creating a new request."""
    report_category: str
    property_address: str
    city: str
    area: str | None = None
    pin_code: str | None = None
    property_type: str
    plot_extent_sqft: Decimal | None = None
    built_up_sqft: Decimal | None = None
    loan_applicant_name: str
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool = True
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
    built_up_sqft: Decimal | None = None
    loan_applicant_name: str | None = None
    city: str | None = None
    area: str | None = None
    pin_code: str | None = None
    eta_days: int | None = None
    price: Decimal | None = None
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool
    parent_report_id: UUID | None = None
    comments: str | None = None
    lender_status: str
    vendor_status: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ReportRequestDetail(ReportRequestResponse):
    """Extended response for detail page."""
    vendor_name: str | None = None
    broadcast_round: int | None = None
    broadcast_deadline: datetime | None = None
    broadcast_status: str | None = None
    report_id: UUID | None = None
    report_status: str | None = None
    report_file_path: str | None = None


class EligibleVendorResponse(BaseModel):
    id: UUID
    name: str
    city: str | None = None
    areas: list[str] | None = None


class RejectReportInput(BaseModel):
    comments: str
```

- [ ] **Step 2: Extend report schemas**

Replace the entire `backend/app/schemas/report.py` with:

```python
from datetime import date, datetime
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


class ReportUploadMeta(BaseModel):
    """Optional metadata submitted with report upload."""
    valuation_amount: Decimal | None = None
    report_date: date | None = None


class RevisionSummary(BaseModel):
    model_config = {"from_attributes": True}

    revision_number: int
    comments: str | None = None
    created_at: datetime | None = None


class ReportDetail(ReportResponse):
    """Extended response with revision history."""
    revisions: list[RevisionSummary] = []
```

- [ ] **Step 3: Create broadcast schemas**

```python
# backend/app/schemas/broadcast.py
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BroadcastInfo(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    broadcast_round: int
    vendor_count: int
    accept_deadline: datetime
    status: str


class RejectionInput(BaseModel):
    reason: str  # LOW_PRICE | NOT_AVAILABLE | DO_NOT_WANT_TO_SHARE
    message: str | None = None
```

- [ ] **Step 4: Create polling schemas**

```python
# backend/app/schemas/polling.py
from datetime import datetime

from pydantic import BaseModel


class PollResponse(BaseModel):
    incoming_requests: int = 0
    updated_requests: int = 0
    last_checked: datetime
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/request.py backend/app/schemas/report.py \
  backend/app/schemas/broadcast.py backend/app/schemas/polling.py
git commit -m "feat: extend schemas for Phase 3 request workflow"
```

---

## Task 3: Billing Service + Tests

**Files:**
- Create: `backend/app/services/billing_service.py`
- Create: `backend/tests/services/test_billing_service.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_billing_service.py
import uuid
from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.billing import VendorEarning, LenderPayable
from app.models.enums import (
    EarningType,
    PayableType,
    PaymentStatus,
    ReportCategory,
    ReportStatus,
    PropertyType,
    RequestType,
    LenderRequestStatus,
)
from app.models.lender import Lender
from app.models.report import Report
from app.models.request import ReportRequest
from app.models.user import Organization, User
from app.models.vendor import Vendor
from app.services import billing_service


async def _setup_billing_data(db: AsyncSession):
    """Create lender, vendor, request, report for billing tests."""
    from app.models.enums import UserType
    from app.services import user_service

    # Lender
    lender_org = Organization(name="Test Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Test Bank", city="Mumbai")
    db.add(lender)
    lender_user = await user_service.create_user(
        db, email="lender@test.com", mobile="9000000001",
        full_name="Lender User", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )

    # Vendor
    vendor_org = Organization(name="Test Vendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="Test Vendor")
    db.add(vendor)
    await db.flush()

    # Request
    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.RECEIVED,
    )
    db.add(request)
    await db.flush()

    # Report
    report = Report(
        vendor_id=vendor.id,
        report_category=ReportCategory.VALUATION,
        status=ReportStatus.UPLOADED,
        city="Mumbai",
    )
    db.add(report)
    await db.flush()

    return lender, vendor, request, report


@pytest.mark.asyncio
async def test_create_billing_entries(db_session: AsyncSession):
    lender, vendor, request, report = await _setup_billing_data(db_session)

    await billing_service.create_billing_entries(
        db_session,
        request=request,
        report=report,
        vendor_id=vendor.id,
    )

    # Check VendorEarning
    result = await db_session.execute(
        select(VendorEarning).where(VendorEarning.request_id == request.id)
    )
    earning = result.scalar_one()
    assert earning.vendor_id == vendor.id
    assert earning.amount == Decimal("2500.00")
    assert earning.earning_type == EarningType.REQUEST
    assert earning.lender_id == lender.id

    # Check LenderPayable
    result = await db_session.execute(
        select(LenderPayable).where(LenderPayable.request_id == request.id)
    )
    payable = result.scalar_one()
    assert payable.lender_id == lender.id
    assert payable.amount == Decimal("2500.00")
    assert payable.payable_type == PayableType.NEW_REQUEST
    assert payable.status == PaymentStatus.PENDING


@pytest.mark.asyncio
async def test_billing_month_format(db_session: AsyncSession):
    lender, vendor, request, report = await _setup_billing_data(db_session)

    await billing_service.create_billing_entries(
        db_session, request=request, report=report, vendor_id=vendor.id,
    )

    result = await db_session.execute(
        select(VendorEarning).where(VendorEarning.request_id == request.id)
    )
    earning = result.scalar_one()
    # Month should be YYYY-MM format
    assert len(earning.month) == 7
    assert earning.month[4] == "-"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/services/test_billing_service.py -v`
Expected: FAIL — `billing_service` module doesn't exist yet.

- [ ] **Step 3: Implement billing service**

```python
# backend/app/services/billing_service.py
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import LenderPayable, VendorEarning
from app.models.enums import EarningType, PayableType, PaymentStatus
from app.models.report import Report
from app.models.request import ReportRequest


async def create_billing_entries(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
) -> tuple[VendorEarning, LenderPayable]:
    """Create VendorEarning + LenderPayable on report acceptance."""
    month = datetime.utcnow().strftime("%Y-%m")

    earning = VendorEarning(
        vendor_id=vendor_id,
        report_id=report.id,
        request_id=request.id,
        lender_id=request.lender_id,
        amount=request.price,
        earning_type=EarningType.REQUEST,
        month=month,
    )
    db.add(earning)

    payable = LenderPayable(
        lender_id=request.lender_id,
        report_id=report.id,
        request_id=request.id,
        amount=request.price,
        payable_type=PayableType.NEW_REQUEST,
        status=PaymentStatus.PENDING,
        month=month,
    )
    db.add(payable)

    await db.flush()
    return earning, payable
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/services/test_billing_service.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/billing_service.py \
  backend/tests/services/test_billing_service.py
git commit -m "feat: add billing service with VendorEarning + LenderPayable creation"
```

---

## Task 4: Broadcast Service + Tests

**Files:**
- Create: `backend/app/services/broadcast_service.py`
- Create: `backend/tests/services/test_broadcast_service.py`

**Context:** ServiceArea model has `vendor_id`, `city`, `areas` (ARRAY of strings), `service_type` (ServiceType enum: VALUATION/LEGAL). The broadcast service needs to match `ReportCategory` to `ServiceType` — both have the same string values.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_broadcast_service.py
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    BroadcastStatus,
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    ServiceType,
    UserType,
    VendorRequestStatus,
)
from app.models.lender import Lender
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.user import Organization, User
from app.models.vendor import ServiceArea, Vendor
from app.services import broadcast_service, user_service


async def _create_lender_and_request(db: AsyncSession):
    lender_org = Organization(name="Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Bank", city="Mumbai")
    db.add(lender)
    lender_user = await user_service.create_user(
        db, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )
    await db.flush()

    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        area="Andheri",
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.SENT,
    )
    db.add(request)
    await db.flush()
    return lender, lender_user, request


async def _create_vendor_with_area(
    db: AsyncSession, name: str, city: str, areas: list[str] | None, service_type: str,
):
    vendor_org = Organization(name=name, type=UserType.VENDOR, city=city)
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name=name)
    db.add(vendor)
    await db.flush()
    sa = ServiceArea(
        vendor_id=vendor.id, city=city, areas=areas,
        service_type=ServiceType(service_type),
    )
    db.add(sa)
    await db.flush()
    return vendor


@pytest.mark.asyncio
async def test_get_eligible_vendors(db_session: AsyncSession):
    await _create_lender_and_request(db_session)
    v1 = await _create_vendor_with_area(db_session, "V1", "Mumbai", ["Andheri", "Bandra"], "VALUATION")
    v2 = await _create_vendor_with_area(db_session, "V2", "Mumbai", None, "VALUATION")  # city-wide
    await _create_vendor_with_area(db_session, "V3", "Delhi", ["Andheri"], "VALUATION")  # wrong city
    await _create_vendor_with_area(db_session, "V4", "Mumbai", ["Andheri"], "LEGAL")  # wrong type

    vendors = await broadcast_service.get_eligible_vendors(
        db_session, city="Mumbai", area="Andheri", report_category="VALUATION",
    )
    vendor_ids = {v.id for v in vendors}
    assert v1.id in vendor_ids
    assert v2.id in vendor_ids
    assert len(vendors) == 2


@pytest.mark.asyncio
async def test_start_broadcast(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    for i in range(3):
        await _create_vendor_with_area(
            db_session, f"V{i}", "Mumbai", ["Andheri"], "VALUATION",
        )

    broadcast = await broadcast_service.start_broadcast(db_session, request=request)

    assert broadcast.broadcast_round == 1
    assert broadcast.status == BroadcastStatus.ACTIVE
    assert len(broadcast.vendor_ids) == 3
    assert request.vendor_status == VendorRequestStatus.INCOMING


@pytest.mark.asyncio
async def test_accept_request(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    vendor = await _create_vendor_with_area(
        db_session, "V1", "Mumbai", ["Andheri"], "VALUATION",
    )
    await broadcast_service.start_broadcast(db_session, request=request)

    acceptance = await broadcast_service.accept_request(
        db_session, request=request, vendor_id=vendor.id,
    )

    assert acceptance.vendor_id == vendor.id
    assert request.vendor_status == VendorRequestStatus.PENDING
    assert request.lender_status == LenderRequestStatus.AWAITED
    # Broadcast should be marked ACCEPTED
    result = await db_session.execute(
        select(RequestBroadcast).where(RequestBroadcast.request_id == request.id)
    )
    bc = result.scalar_one()
    assert bc.status == BroadcastStatus.ACCEPTED


@pytest.mark.asyncio
async def test_reject_request_specified_vendor_triggers_broadcast(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    vendor = await _create_vendor_with_area(
        db_session, "V1", "Mumbai", ["Andheri"], "VALUATION",
    )
    # Simulate direct assignment (no broadcast)
    request.vendor_specified_id = vendor.id
    request.vendor_status = VendorRequestStatus.INCOMING
    request.allow_broadcast_on_reject = True
    await db_session.flush()

    # Add another vendor to be found by broadcast
    await _create_vendor_with_area(
        db_session, "V2", "Mumbai", ["Andheri"], "VALUATION",
    )

    result = await broadcast_service.reject_request(
        db_session, request=request, vendor_id=vendor.id, reason="LOW_PRICE",
    )

    assert result == "broadcast_started"
    # Should have created a broadcast round
    bc_result = await db_session.execute(
        select(RequestBroadcast).where(RequestBroadcast.request_id == request.id)
    )
    bc = bc_result.scalar_one()
    assert bc.broadcast_round == 1


@pytest.mark.asyncio
async def test_assign_direct(db_session: AsyncSession):
    _, _, request = await _create_lender_and_request(db_session)
    vendor = await _create_vendor_with_area(
        db_session, "V1", "Mumbai", ["Andheri"], "VALUATION",
    )

    await broadcast_service.assign_direct(
        db_session, request=request, vendor_id=vendor.id,
    )

    assert request.vendor_status == VendorRequestStatus.INCOMING
    assert request.vendor_specified_id == vendor.id
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/services/test_broadcast_service.py -v`
Expected: FAIL — `broadcast_service` module doesn't exist yet.

- [ ] **Step 3: Implement broadcast service**

```python
# backend/app/services/broadcast_service.py
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import BROADCAST_ACCEPT_WINDOW_MINUTES, VENDORS_PER_BROADCAST_ROUND
from app.models.enums import (
    BroadcastStatus,
    LenderRequestStatus,
    ServiceType,
    VendorRequestStatus,
)
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.vendor import ServiceArea, Vendor


class NoVendorsAvailableError(Exception):
    pass


async def get_eligible_vendors(
    db: AsyncSession,
    *,
    city: str,
    area: str | None = None,
    report_category: str,
    exclude_request_id: UUID | None = None,
) -> list[Vendor]:
    """Find vendors matching city/area/service_type, excluding already-broadcast ones."""
    service_type = ServiceType(report_category)

    stmt = (
        select(Vendor)
        .join(ServiceArea, ServiceArea.vendor_id == Vendor.id)
        .where(
            ServiceArea.city == city,
            ServiceArea.service_type == service_type,
            Vendor.is_active == True,
        )
    )

    # Match area: vendor covers specific area OR serves entire city (areas is NULL)
    if area:
        stmt = stmt.where(
            (ServiceArea.areas.is_(None)) | (ServiceArea.areas.any(area))
        )

    # Exclude vendors already broadcast for this request
    if exclude_request_id:
        # Get all vendor IDs from previous broadcasts for this request
        subq = (
            select(func.unnest(RequestBroadcast.vendor_ids))
            .where(RequestBroadcast.request_id == exclude_request_id)
            .scalar_subquery()
        )
        stmt = stmt.where(Vendor.id.not_in(select(subq)))

    stmt = stmt.distinct().order_by(Vendor.created_at)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def assign_direct(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
) -> None:
    """Assign a request directly to a specified vendor (no broadcast)."""
    request.vendor_specified_id = vendor_id
    request.vendor_status = VendorRequestStatus.INCOMING
    await db.flush()


async def start_broadcast(
    db: AsyncSession,
    *,
    request: ReportRequest,
) -> RequestBroadcast:
    """Start broadcast round 1 for a request."""
    vendors = await get_eligible_vendors(
        db,
        city=request.city,
        area=request.area,
        report_category=request.report_category.value,
        exclude_request_id=request.id,
    )

    if not vendors:
        raise NoVendorsAvailableError(
            f"No vendors available for city={request.city}, "
            f"area={request.area}, category={request.report_category}"
        )

    batch = vendors[:VENDORS_PER_BROADCAST_ROUND]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=BROADCAST_ACCEPT_WINDOW_MINUTES)

    broadcast = RequestBroadcast(
        request_id=request.id,
        vendor_ids=[v.id for v in batch],
        broadcast_round=1,
        accept_deadline=deadline,
        status=BroadcastStatus.ACTIVE,
    )
    db.add(broadcast)

    request.vendor_status = VendorRequestStatus.INCOMING
    await db.flush()
    return broadcast


async def advance_broadcast_round(
    db: AsyncSession,
    *,
    request: ReportRequest,
    current_broadcast: RequestBroadcast,
) -> RequestBroadcast | None:
    """Expire current round and start next if vendors available."""
    current_broadcast.status = BroadcastStatus.EXPIRED
    await db.flush()

    vendors = await get_eligible_vendors(
        db,
        city=request.city,
        area=request.area,
        report_category=request.report_category.value,
        exclude_request_id=request.id,
    )

    if not vendors:
        return None  # No more vendors, request stays in current state

    batch = vendors[:VENDORS_PER_BROADCAST_ROUND]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=BROADCAST_ACCEPT_WINDOW_MINUTES)

    next_broadcast = RequestBroadcast(
        request_id=request.id,
        vendor_ids=[v.id for v in batch],
        broadcast_round=current_broadcast.broadcast_round + 1,
        accept_deadline=deadline,
        status=BroadcastStatus.ACTIVE,
    )
    db.add(next_broadcast)

    request.vendor_status = VendorRequestStatus.INCOMING
    await db.flush()
    return next_broadcast


async def accept_request(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
) -> RequestAcceptance:
    """Vendor accepts a request."""
    acceptance = RequestAcceptance(
        request_id=request.id,
        vendor_id=vendor_id,
    )
    db.add(acceptance)

    request.vendor_status = VendorRequestStatus.PENDING
    request.lender_status = LenderRequestStatus.AWAITED

    # Mark active broadcast as ACCEPTED
    result = await db.execute(
        select(RequestBroadcast).where(
            RequestBroadcast.request_id == request.id,
            RequestBroadcast.status == BroadcastStatus.ACTIVE,
        )
    )
    active_broadcast = result.scalar_one_or_none()
    if active_broadcast:
        active_broadcast.status = BroadcastStatus.ACCEPTED

    await db.flush()
    return acceptance


async def reject_request(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
    reason: str,
    message: str | None = None,
) -> str:
    """Vendor rejects a request. Returns action taken."""
    # If this was a direct assignment with allow_broadcast, start broadcast
    if (
        request.vendor_specified_id == vendor_id
        and request.allow_broadcast_on_reject
    ):
        request.vendor_specified_id = None  # Clear specified vendor
        try:
            await start_broadcast(db, request=request)
            return "broadcast_started"
        except NoVendorsAvailableError:
            request.vendor_status = VendorRequestStatus.DENIED
            await db.flush()
            return "no_vendors"

    # If part of a broadcast, just mark denied
    request.vendor_status = VendorRequestStatus.DENIED
    await db.flush()
    return "rejected"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/services/test_broadcast_service.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/broadcast_service.py \
  backend/tests/services/test_broadcast_service.py
git commit -m "feat: add broadcast service with vendor selection and round management"
```

---

## Task 5: Report Service + Tests

**Files:**
- Create: `backend/app/services/report_service.py`
- Create: `backend/tests/services/test_report_service.py`

**Context:** The `media_data` Docker volume is mounted at `/app/media`. Reports saved to `/app/media/reports/{vendor_id}/{report_id}/`.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_report_service.py
import io
import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    ReportStatus,
    RequestType,
    UserType,
    VendorRequestStatus,
)
from app.models.lender import Lender
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest
from app.models.user import Organization
from app.models.vendor import Vendor
from app.services import report_service, user_service


async def _setup_request_with_vendor(db: AsyncSession):
    """Create lender + vendor + accepted request."""
    lender_org = Organization(name="Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Bank", city="Mumbai")
    db.add(lender)
    lender_user = await user_service.create_user(
        db, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )

    vendor_org = Organization(name="Vendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="Vendor")
    db.add(vendor)
    await db.flush()

    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        area="Andheri",
        property_address="123 Main St",
        loan_applicant_name="John Doe",
        plot_extent_sqft=Decimal("1000.00"),
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.AWAITED,
        vendor_status=VendorRequestStatus.PENDING,
    )
    db.add(request)
    await db.flush()
    return lender, vendor, lender_user, request


@pytest.mark.asyncio
async def test_upload_report_creates_report(db_session: AsyncSession):
    lender, vendor, _, request = await _setup_request_with_vendor(db_session)

    report, file_path = await report_service.create_report_for_request(
        db_session,
        request=request,
        vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
        valuation_amount=Decimal("5000000.00"),
        report_date=date(2026, 4, 9),
    )

    assert report.vendor_id == vendor.id
    assert report.status == ReportStatus.UPLOADED
    assert report.report_category == ReportCategory.VALUATION
    assert report.city == "Mumbai"
    assert report.property_address == "123 Main St"
    assert report.valuation_amount == Decimal("5000000.00")
    assert request.vendor_status == VendorRequestStatus.SENT
    assert request.lender_status == LenderRequestStatus.RECEIVED


@pytest.mark.asyncio
async def test_submit_revision_creates_revision(db_session: AsyncSession):
    _, vendor, _, request = await _setup_request_with_vendor(db_session)

    report, _ = await report_service.create_report_for_request(
        db_session,
        request=request,
        vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
    )

    # Simulate lender sending back for revision
    request.lender_status = LenderRequestStatus.SENT_FOR_REVIEW
    request.vendor_status = VendorRequestStatus.REVISION
    await db_session.flush()

    revision = await report_service.submit_revision(
        db_session,
        report=report,
        request=request,
        file_path="reports/test/report_rev1.pdf",
        comments="Updated valuation",
    )

    assert revision.revision_number == 1
    assert revision.comments == "Updated valuation"
    assert report.uploaded_file_path == "reports/test/report_rev1.pdf"
    assert request.vendor_status == VendorRequestStatus.SENT
    assert request.lender_status == LenderRequestStatus.RECEIVED
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/services/test_report_service.py -v`
Expected: FAIL — `report_service` module doesn't exist yet.

- [ ] **Step 3: Implement report service**

```python
# backend/app/services/report_service.py
import os
import uuid as uuid_mod
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ALLOWED_CONTENT_TYPES, MAX_UPLOAD_SIZE_MB, MEDIA_ROOT, REPORTS_DIR
from app.models.enums import (
    LenderRequestStatus,
    ReportCategory,
    ReportStatus,
    VendorRequestStatus,
)
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest


class InvalidFileError(Exception):
    pass


def validate_upload(content_type: str, size: int) -> None:
    """Validate file type and size."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidFileError(f"File type '{content_type}' not allowed. Only PDF accepted.")
    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if size > max_bytes:
        raise InvalidFileError(f"File too large. Maximum {MAX_UPLOAD_SIZE_MB}MB allowed.")


def generate_report_path(vendor_id: UUID, report_id: UUID, suffix: str = "") -> str:
    """Generate the storage path for a report file."""
    filename = f"{report_id}{suffix}.pdf"
    return os.path.join(REPORTS_DIR, str(vendor_id), str(report_id), filename)


def get_full_path(relative_path: str) -> str:
    """Get absolute path from relative path."""
    return os.path.join(MEDIA_ROOT, relative_path)


async def save_file(relative_path: str, content: bytes) -> None:
    """Save file content to disk."""
    full_path = get_full_path(relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(content)


async def create_report_for_request(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
    file_path: str,
    valuation_amount: Decimal | None = None,
    report_date: date | None = None,
) -> tuple[Report, str]:
    """Create a Report linked to a request, updating statuses."""
    report = Report(
        vendor_id=vendor_id,
        report_category=request.report_category,
        status=ReportStatus.UPLOADED,
        property_address=request.property_address,
        city=request.city,
        property_type=request.property_type,
        plot_extent_sqft=request.plot_extent_sqft,
        loan_applicant_name=request.loan_applicant_name,
        valuation_amount=valuation_amount,
        report_date=report_date,
        uploaded_file_path=file_path,
    )
    db.add(report)

    request.vendor_status = VendorRequestStatus.SENT
    request.lender_status = LenderRequestStatus.RECEIVED

    await db.flush()
    return report, file_path


async def submit_revision(
    db: AsyncSession,
    *,
    report: Report,
    request: ReportRequest,
    file_path: str,
    comments: str | None = None,
) -> ReportRevision:
    """Create a revision for an existing report."""
    # Get next revision number
    result = await db.execute(
        select(func.coalesce(func.max(ReportRevision.revision_number), 0))
        .where(ReportRevision.report_id == report.id)
    )
    max_rev = result.scalar()
    next_rev = max_rev + 1

    revision = ReportRevision(
        report_id=report.id,
        revision_number=next_rev,
        comments=comments,
    )
    db.add(revision)

    # Update report with new file
    report.uploaded_file_path = file_path
    report.status = ReportStatus.UPLOADED

    # Reset request statuses
    request.vendor_status = VendorRequestStatus.SENT
    request.lender_status = LenderRequestStatus.RECEIVED

    await db.flush()
    return revision


async def get_report(db: AsyncSession, report_id: UUID) -> Report | None:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    return result.scalar_one_or_none()


async def get_report_revisions(db: AsyncSession, report_id: UUID) -> list[ReportRevision]:
    result = await db.execute(
        select(ReportRevision)
        .where(ReportRevision.report_id == report_id)
        .order_by(ReportRevision.revision_number.desc())
    )
    return list(result.scalars().all())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/services/test_report_service.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/report_service.py \
  backend/tests/services/test_report_service.py
git commit -m "feat: add report service with upload and revision support"
```

---

## Task 6: Request Service + Tests

**Files:**
- Create: `backend/app/services/request_service.py`
- Create: `backend/tests/services/test_request_service.py`

**Context:** This service orchestrates the full request lifecycle: create → price → assign/broadcast → accept/reject report → billing → listing. It calls `pricing_service`, `broadcast_service`, `billing_service`.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/services/test_request_service.py
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import LenderPayable, VendorEarning
from app.models.enums import (
    LenderRequestStatus,
    ListingStatus,
    PaymentStatus,
    PropertyType,
    ReportCategory,
    ReportStatus,
    RequestType,
    ServiceType,
    UserType,
    VendorRequestStatus,
)
from app.models.lender import Lender
from app.models.listing import Listing, ListingReport
from app.models.pricing import PricingRule
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest
from app.models.user import Organization
from app.models.vendor import ServiceArea, Vendor
from app.services import request_service, user_service


async def _full_setup(db: AsyncSession):
    """Create lender with pricing + vendor with service area."""
    # Lender
    lender_org = Organization(name="Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Bank", city="Mumbai")
    db.add(lender)
    lender_user = await user_service.create_user(
        db, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )

    # Pricing rule
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

    # Vendor
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

    return lender, lender_user, vendor


@pytest.mark.asyncio
async def test_create_request_with_broadcast(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
    )

    assert request.price == Decimal("2500.00")
    assert request.lender_status == LenderRequestStatus.SENT
    assert request.vendor_status == VendorRequestStatus.INCOMING
    assert request.request_type == RequestType.NEW


@pytest.mark.asyncio
async def test_create_request_with_specified_vendor(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
        vendor_specified_id=vendor.id,
    )

    assert request.vendor_specified_id == vendor.id
    assert request.vendor_status == VendorRequestStatus.INCOMING


@pytest.mark.asyncio
async def test_accept_report_creates_billing_and_listing(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St, Andheri",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
        vendor_specified_id=vendor.id,
    )

    # Simulate vendor accepting + uploading
    from app.services import broadcast_service, report_service
    await broadcast_service.accept_request(db_session, request=request, vendor_id=vendor.id)
    report, _ = await report_service.create_report_for_request(
        db_session,
        request=request,
        vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
    )

    # Lender accepts
    await request_service.accept_report(
        db_session, request=request, report=report, vendor_id=vendor.id,
    )

    assert request.lender_status == LenderRequestStatus.ACCEPTED
    assert request.vendor_status == VendorRequestStatus.ACCEPTED

    # Check billing entries
    result = await db_session.execute(
        select(VendorEarning).where(VendorEarning.request_id == request.id)
    )
    assert result.scalar_one() is not None

    result = await db_session.execute(
        select(LenderPayable).where(LenderPayable.request_id == request.id)
    )
    assert result.scalar_one() is not None

    # Check listing created
    result = await db_session.execute(select(Listing))
    listing = result.scalar_one()
    assert listing.city == "Mumbai"
    assert listing.report_count == 1


@pytest.mark.asyncio
async def test_reject_report_creates_revision(db_session: AsyncSession):
    lender, lender_user, vendor = await _full_setup(db_session)

    request = await request_service.create_request(
        db_session,
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        branch_id=None,
        report_category="VALUATION",
        property_address="123 Main St",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        loan_applicant_name="John Doe",
        vendor_specified_id=vendor.id,
    )

    from app.services import broadcast_service, report_service
    await broadcast_service.accept_request(db_session, request=request, vendor_id=vendor.id)
    report, _ = await report_service.create_report_for_request(
        db_session, request=request, vendor_id=vendor.id,
        file_path="reports/test/report.pdf",
    )

    await request_service.reject_report(
        db_session, request=request, report=report, comments="Needs updated valuation",
    )

    assert request.lender_status == LenderRequestStatus.SENT_FOR_REVIEW
    assert request.vendor_status == VendorRequestStatus.REVISION

    result = await db_session.execute(
        select(ReportRevision).where(ReportRevision.report_id == report.id)
    )
    rev = result.scalar_one()
    assert rev.comments == "Needs updated valuation"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/services/test_request_service.py -v`
Expected: FAIL — `request_service` module doesn't exist yet.

- [ ] **Step 3: Implement request service**

```python
# backend/app/services/request_service.py
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    ListingStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    VendorRequestStatus,
)
from app.models.listing import Listing, ListingReport
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest, RequestBroadcast
from app.services import billing_service, broadcast_service, pricing_service


class InvalidStatusTransition(Exception):
    pass


async def create_request(
    db: AsyncSession,
    *,
    lender_id: UUID,
    lender_user_id: UUID,
    branch_id: UUID | None = None,
    report_category: str,
    property_address: str,
    city: str,
    area: str | None = None,
    pin_code: str | None = None,
    property_type: str,
    plot_extent_sqft: Decimal | None = None,
    built_up_sqft: Decimal | None = None,
    loan_applicant_name: str,
    vendor_specified_id: UUID | None = None,
    allow_broadcast_on_reject: bool = True,
    comments: str | None = None,
) -> ReportRequest:
    """Create a new report request with pricing, then assign or broadcast."""
    # Calculate price
    price_result = await pricing_service.get_price(
        db,
        lender_id=lender_id,
        report_category=report_category,
        city=city,
        area=area,
        property_type=property_type,
        request_type="NEW",
    )

    request = ReportRequest(
        lender_id=lender_id,
        lender_user_id=lender_user_id,
        branch_id=branch_id,
        request_type=RequestType.NEW,
        report_category=ReportCategory(report_category),
        property_type=PropertyType(property_type),
        property_address=property_address,
        city=city,
        area=area,
        plot_extent_sqft=plot_extent_sqft,
        loan_applicant_name=loan_applicant_name,
        price=price_result.amount,
        vendor_specified_id=vendor_specified_id,
        allow_broadcast_on_reject=allow_broadcast_on_reject,
        comments=comments,
        lender_status=LenderRequestStatus.SENT,
    )
    db.add(request)
    await db.flush()

    # Assign to vendor or broadcast
    if vendor_specified_id:
        await broadcast_service.assign_direct(
            db, request=request, vendor_id=vendor_specified_id,
        )
    else:
        await broadcast_service.start_broadcast(db, request=request)

    return request


async def list_requests(
    db: AsyncSession,
    *,
    lender_id: UUID | None = None,
    vendor_id: UUID | None = None,
    status_filter: str | None = None,
    report_category: str | None = None,
    property_type: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> list[ReportRequest]:
    """List requests scoped by lender or vendor."""
    stmt = select(ReportRequest)

    if lender_id:
        stmt = stmt.where(ReportRequest.lender_id == lender_id)

    if status_filter:
        if status_filter == "pending":
            stmt = stmt.where(
                ReportRequest.lender_status.in_([
                    LenderRequestStatus.SENT,
                    LenderRequestStatus.AWAITED,
                ])
            )
        elif status_filter == "active":
            stmt = stmt.where(
                ReportRequest.lender_status.in_([
                    LenderRequestStatus.RECEIVED,
                    LenderRequestStatus.SENT_FOR_REVIEW,
                ])
            )
        elif status_filter == "completed":
            stmt = stmt.where(
                ReportRequest.lender_status == LenderRequestStatus.ACCEPTED
            )

    if report_category:
        stmt = stmt.where(
            ReportRequest.report_category == ReportCategory(report_category)
        )
    if property_type:
        stmt = stmt.where(
            ReportRequest.property_type == PropertyType(property_type)
        )

    stmt = stmt.order_by(ReportRequest.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_request(db: AsyncSession, request_id: UUID) -> ReportRequest | None:
    result = await db.execute(
        select(ReportRequest).where(ReportRequest.id == request_id)
    )
    return result.scalar_one_or_none()


async def accept_report(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
) -> None:
    """Lender accepts the report — billing + listing."""
    if request.lender_status not in (
        LenderRequestStatus.RECEIVED,
    ):
        raise InvalidStatusTransition(
            f"Cannot accept from status {request.lender_status}"
        )

    request.lender_status = LenderRequestStatus.ACCEPTED
    request.vendor_status = VendorRequestStatus.ACCEPTED
    report.listing_approved = True

    # Create billing entries
    await billing_service.create_billing_entries(
        db, request=request, report=report, vendor_id=vendor_id,
    )

    # Create or update listing
    await _create_or_update_listing(db, report=report)

    await db.flush()


async def reject_report(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    comments: str,
) -> ReportRevision:
    """Lender sends report back for revision."""
    if request.lender_status not in (
        LenderRequestStatus.RECEIVED,
    ):
        raise InvalidStatusTransition(
            f"Cannot reject from status {request.lender_status}"
        )

    request.lender_status = LenderRequestStatus.SENT_FOR_REVIEW
    request.vendor_status = VendorRequestStatus.REVISION

    # Get next revision number
    result = await db.execute(
        select(func.coalesce(func.max(ReportRevision.revision_number), 0))
        .where(ReportRevision.report_id == report.id)
    )
    max_rev = result.scalar()

    revision = ReportRevision(
        report_id=report.id,
        revision_number=max_rev + 1,
        comments=comments,
    )
    db.add(revision)
    await db.flush()
    return revision


async def _create_or_update_listing(
    db: AsyncSession,
    *,
    report: Report,
) -> Listing:
    """Find or create a listing for this report's location."""
    macro = report.macro_location or report.city or "Unknown"

    result = await db.execute(
        select(Listing).where(
            Listing.city == report.city,
            Listing.macro_location == macro,
            Listing.property_type == report.property_type,
            Listing.is_active == True,
        )
    )
    listing = result.scalar_one_or_none()

    if not listing:
        listing = Listing(
            macro_location=macro,
            city=report.city,
            property_type=report.property_type,
            status=ListingStatus.AVAILABLE,
            report_count=0,
        )
        db.add(listing)
        await db.flush()

    listing.report_count += 1
    listing.latest_report_date = report.report_date

    lr = ListingReport(
        listing_id=listing.id,
        report_id=report.id,
    )
    db.add(lr)
    await db.flush()
    return listing
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/services/test_request_service.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/request_service.py \
  backend/tests/services/test_request_service.py
git commit -m "feat: add request service with full lifecycle orchestration"
```

---

## Task 7: Lender Requests API + Tests

**Files:**
- Create: `backend/app/api/lender/requests.py`
- Create: `backend/tests/api/test_lender_requests.py`

- [ ] **Step 1: Implement lender requests router**

```python
# backend/app/api/lender/requests.py
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.schemas.request import (
    EligibleVendorResponse,
    RejectReportInput,
    ReportRequestCreateInput,
    ReportRequestDetail,
    ReportRequestResponse,
)
from app.services import broadcast_service, report_service, request_service
from app.services.broadcast_service import NoVendorsAvailableError
from app.services.pricing_service import PricingNotFoundError
from app.services.request_service import InvalidStatusTransition

router = APIRouter(prefix="/api/lender/requests", tags=["lender-requests"])


@router.post("/", response_model=ReportRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: ReportRequestCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    """Create a new report request."""
    # Get lender_id from the current user's lender association
    from sqlalchemy import select
    from app.models.lender import LenderUser
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == current_user.id)
    )
    lender_user = result.scalar_one_or_none()
    if not lender_user:
        raise HTTPException(status_code=400, detail="User not associated with a lender")

    try:
        request = await request_service.create_request(
            db,
            lender_id=lender_user.lender_id,
            lender_user_id=current_user.id,
            branch_id=None,
            report_category=payload.report_category,
            property_address=payload.property_address,
            city=payload.city,
            area=payload.area,
            pin_code=payload.pin_code,
            property_type=payload.property_type,
            plot_extent_sqft=payload.plot_extent_sqft,
            built_up_sqft=payload.built_up_sqft,
            loan_applicant_name=payload.loan_applicant_name,
            vendor_specified_id=payload.vendor_specified_id,
            allow_broadcast_on_reject=payload.allow_broadcast_on_reject,
            comments=payload.comments,
        )
    except PricingNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NoVendorsAvailableError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return request


@router.get("/", response_model=list[ReportRequestResponse])
async def list_requests(
    status_filter: str | None = Query(None, alias="status"),
    report_category: str | None = Query(None),
    property_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    from sqlalchemy import select
    from app.models.lender import LenderUser
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == current_user.id)
    )
    lender_user = result.scalar_one_or_none()
    if not lender_user:
        raise HTTPException(status_code=400, detail="User not associated with a lender")

    return await request_service.list_requests(
        db,
        lender_id=lender_user.lender_id,
        status_filter=status_filter,
        report_category=report_category,
        property_type=property_type,
        page=page,
        per_page=per_page,
    )


@router.get("/vendors", response_model=list[EligibleVendorResponse])
async def get_eligible_vendors(
    city: str = Query(...),
    report_category: str = Query(...),
    area: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    vendors = await broadcast_service.get_eligible_vendors(
        db, city=city, area=area, report_category=report_category,
    )
    return [
        EligibleVendorResponse(
            id=v.id,
            name=v.name,
            city=v.office_city,
        )
        for v in vendors
    ]


@router.get("/{request_id}", response_model=ReportRequestResponse)
async def get_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.post("/{request_id}/accept")
async def accept_report(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Find the report for this request
    from sqlalchemy import select
    from app.models.request import RequestAcceptance
    acceptance_result = await db.execute(
        select(RequestAcceptance).where(RequestAcceptance.request_id == request_id)
    )
    acceptance = acceptance_result.scalar_one_or_none()
    if not acceptance:
        raise HTTPException(status_code=400, detail="No vendor accepted this request yet")

    from app.models.report import Report
    report_result = await db.execute(
        select(Report).where(
            Report.vendor_id == acceptance.vendor_id,
            Report.is_active == True,
        ).order_by(Report.created_at.desc())
    )
    report = report_result.scalars().first()
    if not report:
        raise HTTPException(status_code=400, detail="No report uploaded yet")

    try:
        await request_service.accept_report(
            db, request=req, report=report, vendor_id=acceptance.vendor_id,
        )
    except InvalidStatusTransition as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"detail": "Report accepted"}


@router.post("/{request_id}/reject")
async def reject_report(
    request_id: UUID,
    payload: RejectReportInput,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    from sqlalchemy import select
    from app.models.request import RequestAcceptance
    from app.models.report import Report
    acceptance_result = await db.execute(
        select(RequestAcceptance).where(RequestAcceptance.request_id == request_id)
    )
    acceptance = acceptance_result.scalar_one_or_none()
    if not acceptance:
        raise HTTPException(status_code=400, detail="No vendor accepted this request yet")

    report_result = await db.execute(
        select(Report).where(
            Report.vendor_id == acceptance.vendor_id,
            Report.is_active == True,
        ).order_by(Report.created_at.desc())
    )
    report = report_result.scalars().first()
    if not report:
        raise HTTPException(status_code=400, detail="No report uploaded yet")

    try:
        await request_service.reject_report(
            db, request=req, report=report, comments=payload.comments,
        )
    except InvalidStatusTransition as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"detail": "Report sent back for revision"}
```

- [ ] **Step 2: Write API tests**

```python
# backend/tests/api/test_lender_requests.py
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import (
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
    """Create lender org, user, pricing rule. Return (token, lender_id)."""
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
        role="ORG_ADMIN",
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
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pytest backend/tests/api/test_lender_requests.py -v`
Expected: 4 passed. (Note: router must be registered in main.py first — see Task 11.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/lender/requests.py \
  backend/tests/api/test_lender_requests.py
git commit -m "feat: add lender requests API (create, list, vendors, accept, reject)"
```

---

## Task 8: Vendor Requests API + Tests

**Files:**
- Create: `backend/app/api/vendor/requests.py`
- Create: `backend/tests/api/test_vendor_requests.py`

- [ ] **Step 1: Implement vendor requests router**

```python
# backend/app/api/vendor/requests.py
import os
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import VendorRequestStatus
from app.models.report import Report
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.broadcast import RejectionInput
from app.schemas.report import ReportResponse
from app.schemas.request import ReportRequestResponse
from app.services import broadcast_service, report_service
from app.services.report_service import InvalidFileError

router = APIRouter(prefix="/api/vendor/requests", tags=["vendor-requests"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser).where(VendorUser.user_id == user_id)
    )
    vu = result.scalar_one_or_none()
    if not vu:
        raise HTTPException(status_code=400, detail="User not associated with a vendor")
    return vu.vendor_id


@router.get("/", response_model=list[ReportRequestResponse])
async def list_requests(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """List requests for vendor: incoming, pending, completed."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    # Find requests where this vendor is in an active broadcast OR directly assigned
    stmt = select(ReportRequest).where(
        (ReportRequest.vendor_specified_id == vendor_id)
        | (
            ReportRequest.id.in_(
                select(RequestBroadcast.request_id).where(
                    RequestBroadcast.vendor_ids.any(vendor_id)
                )
            )
        )
        | (
            ReportRequest.id.in_(
                select(RequestAcceptance.request_id).where(
                    RequestAcceptance.vendor_id == vendor_id
                )
            )
        )
    )

    if status_filter == "incoming":
        stmt = stmt.where(ReportRequest.vendor_status == VendorRequestStatus.INCOMING)
    elif status_filter == "pending":
        stmt = stmt.where(
            ReportRequest.vendor_status.in_([
                VendorRequestStatus.PENDING,
                VendorRequestStatus.REVISION,
            ])
        )
    elif status_filter == "completed":
        stmt = stmt.where(
            ReportRequest.vendor_status.in_([
                VendorRequestStatus.SENT,
                VendorRequestStatus.ACCEPTED,
            ])
        )

    stmt = stmt.order_by(ReportRequest.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{request_id}", response_model=ReportRequestResponse)
async def get_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("VENDOR")),
):
    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.post("/{request_id}/accept")
async def accept_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    acceptance = await broadcast_service.accept_request(
        db, request=req, vendor_id=vendor_id,
    )
    return {"detail": "Request accepted", "acceptance_id": str(acceptance.id)}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: UUID,
    payload: RejectionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    result = await broadcast_service.reject_request(
        db, request=req, vendor_id=vendor_id,
        reason=payload.reason, message=payload.message,
    )
    return {"detail": f"Request rejected", "action": result}


@router.post("/{request_id}/upload", response_model=ReportResponse)
async def upload_report(
    request_id: UUID,
    file: UploadFile = File(...),
    valuation_amount: Decimal | None = Form(None),
    report_date: date | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Upload a report PDF for an accepted request."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Validate file
    try:
        content = await file.read()
        report_service.validate_upload(file.content_type, len(content))
    except InvalidFileError as e:
        raise HTTPException(status_code=400, detail=str(e))

    import uuid
    report_id = uuid.uuid4()
    relative_path = report_service.generate_report_path(vendor_id, report_id)
    await report_service.save_file(relative_path, content)

    report, _ = await report_service.create_report_for_request(
        db,
        request=req,
        vendor_id=vendor_id,
        file_path=relative_path,
        valuation_amount=valuation_amount,
        report_date=report_date,
    )
    return report


@router.post("/{request_id}/revise", response_model=ReportResponse)
async def revise_report(
    request_id: UUID,
    file: UploadFile = File(...),
    comments: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    """Submit a revised report."""
    vendor_id = await _get_vendor_id(db, current_user.id)

    from app.services import request_service
    req = await request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Find existing report
    result = await db.execute(
        select(Report).where(
            Report.vendor_id == vendor_id,
            Report.is_active == True,
        ).order_by(Report.created_at.desc())
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=400, detail="No existing report found to revise")

    try:
        content = await file.read()
        report_service.validate_upload(file.content_type, len(content))
    except InvalidFileError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get revision number for filename
    from sqlalchemy import func
    from app.models.report import ReportRevision
    rev_result = await db.execute(
        select(func.coalesce(func.max(ReportRevision.revision_number), 0))
        .where(ReportRevision.report_id == report.id)
    )
    next_rev = rev_result.scalar() + 1

    relative_path = report_service.generate_report_path(
        vendor_id, report.id, suffix=f"_rev{next_rev}",
    )
    await report_service.save_file(relative_path, content)

    await report_service.submit_revision(
        db, report=report, request=req, file_path=relative_path, comments=comments,
    )
    return report
```

- [ ] **Step 2: Write API tests**

```python
# backend/tests/api/test_vendor_requests.py
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.enums import (
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    ServiceType,
    UserType,
    VendorRequestStatus,
    VendorRole,
)
from app.models.lender import Lender
from app.models.request import ReportRequest
from app.models.user import Organization
from app.models.vendor import ServiceArea, Vendor, VendorUser
from app.services import user_service


async def _setup_vendor_with_request(db: AsyncSession):
    """Create vendor + lender + request. Return (vendor_token, request_id)."""
    # Lender
    lender_org = Organization(name="Bank", type=UserType.LENDER, city="Mumbai")
    db.add(lender_org)
    await db.flush()
    lender = Lender(organization_id=lender_org.id, name="Bank", city="Mumbai")
    db.add(lender)
    lender_user = await user_service.create_user(
        db, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )

    # Vendor
    vendor_org = Organization(name="Vendor", type=UserType.VENDOR, city="Mumbai")
    db.add(vendor_org)
    await db.flush()
    vendor = Vendor(organization_id=vendor_org.id, name="Vendor")
    db.add(vendor)
    await db.flush()
    vendor_user = await user_service.create_user(
        db, email="vendor@test.com", mobile="9000000002",
        full_name="Vendor User", password="test123",
        user_type=UserType.VENDOR, organization_id=vendor_org.id,
    )
    vu = VendorUser(
        user_id=vendor_user.id, vendor_id=vendor.id,
        role=VendorRole.VENDOR_ADMIN,
    )
    db.add(vu)

    sa = ServiceArea(
        vendor_id=vendor.id, city="Mumbai", areas=["Andheri"],
        service_type=ServiceType.VALUATION,
    )
    db.add(sa)

    # Request assigned to this vendor
    request = ReportRequest(
        lender_id=lender.id,
        lender_user_id=lender_user.id,
        request_type=RequestType.NEW,
        report_category=ReportCategory.VALUATION,
        property_type=PropertyType.RESIDENTIAL,
        city="Mumbai",
        area="Andheri",
        property_address="123 Main St",
        loan_applicant_name="John Doe",
        price=Decimal("2500.00"),
        lender_status=LenderRequestStatus.SENT,
        vendor_status=VendorRequestStatus.INCOMING,
        vendor_specified_id=vendor.id,
    )
    db.add(request)
    await db.flush()

    token = create_access_token(str(vendor_user.id))
    return token, str(request.id), str(vendor.id)


@pytest.mark.asyncio
async def test_vendor_accept_request(client: AsyncClient, db_session: AsyncSession):
    token, request_id, _ = await _setup_vendor_with_request(db_session)

    response = await client.post(
        f"/api/vendor/requests/{request_id}/accept",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "accepted" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_vendor_reject_request(client: AsyncClient, db_session: AsyncSession):
    token, request_id, _ = await _setup_vendor_with_request(db_session)

    response = await client.post(
        f"/api/vendor/requests/{request_id}/reject",
        json={"reason": "LOW_PRICE", "message": "Price too low"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_vendor_list_requests(client: AsyncClient, db_session: AsyncSession):
    token, _, _ = await _setup_vendor_with_request(db_session)

    response = await client.get(
        "/api/vendor/requests/?status=incoming",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_requires_vendor_role(client: AsyncClient, db_session: AsyncSession):
    lender_org = Organization(name="Bank", type=UserType.LENDER)
    db_session.add(lender_org)
    await db_session.flush()
    user = await user_service.create_user(
        db_session, email="lender@test.com", mobile="9000000001",
        full_name="Lender", password="test123",
        user_type=UserType.LENDER, organization_id=lender_org.id,
    )
    token = create_access_token(str(user.id))

    response = await client.get(
        "/api/vendor/requests/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pytest backend/tests/api/test_vendor_requests.py -v`
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/vendor/requests.py \
  backend/tests/api/test_vendor_requests.py
git commit -m "feat: add vendor requests API (list, accept, reject, upload, revise)"
```

---

## Task 9: Polling + Download APIs

**Files:**
- Create: `backend/app/api/common/polling.py`
- Create: `backend/app/api/common/download.py`

- [ ] **Step 1: Implement polling endpoint**

```python
# backend/app/api/common/polling.py
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import LenderRequestStatus, VendorRequestStatus
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.user import User
from app.models.lender import LenderUser
from app.models.vendor import VendorUser
from app.schemas.polling import PollResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/poll", response_model=PollResponse)
async def poll(
    since: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return counts of new/updated items since last poll."""
    now = datetime.now(timezone.utc)
    if not since:
        since = datetime.min.replace(tzinfo=timezone.utc)

    incoming = 0
    updated = 0

    if current_user.user_type == "VENDOR":
        result = await db.execute(
            select(VendorUser).where(VendorUser.user_id == current_user.id)
        )
        vu = result.scalar_one_or_none()
        if vu:
            # Count incoming requests
            count_result = await db.execute(
                select(func.count(ReportRequest.id)).where(
                    ReportRequest.vendor_status == VendorRequestStatus.INCOMING,
                    ReportRequest.updated_at > since,
                    (
                        (ReportRequest.vendor_specified_id == vu.vendor_id)
                        | ReportRequest.id.in_(
                            select(RequestBroadcast.request_id).where(
                                RequestBroadcast.vendor_ids.any(vu.vendor_id)
                            )
                        )
                    ),
                )
            )
            incoming = count_result.scalar() or 0

    elif current_user.user_type == "LENDER":
        result = await db.execute(
            select(LenderUser).where(LenderUser.user_id == current_user.id)
        )
        lu = result.scalar_one_or_none()
        if lu:
            count_result = await db.execute(
                select(func.count(ReportRequest.id)).where(
                    ReportRequest.lender_id == lu.lender_id,
                    ReportRequest.updated_at > since,
                )
            )
            updated = count_result.scalar() or 0

    return PollResponse(
        incoming_requests=incoming,
        updated_requests=updated,
        last_checked=now,
    )
```

- [ ] **Step 2: Implement download endpoint**

```python
# backend/app/api/common/download.py
import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import MEDIA_ROOT
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{report_id}/download")
async def download_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a report PDF. Auth-checked."""
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="No file uploaded for this report")

    full_path = os.path.join(MEDIA_ROOT, report.uploaded_file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=full_path,
        media_type="application/pdf",
        filename=os.path.basename(report.uploaded_file_path),
    )
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/common/polling.py backend/app/api/common/download.py
git commit -m "feat: add polling and report download endpoints"
```

---

## Task 10: Celery Jobs

**Files:**
- Create: `backend/app/jobs/auto_accept.py`
- Create: `backend/app/jobs/broadcast_tasks.py`

**Context:** The `celery_app.py` already references these task paths: `app.jobs.auto_accept.auto_accept_reports` and `app.jobs.broadcast_tasks.check_broadcast_rounds`.

- [ ] **Step 1: Implement auto-accept job**

```python
# backend/app/jobs/auto_accept.py
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.constants import AUTO_ACCEPT_DAYS
from app.core.database import async_session_factory
from app.jobs.celery_app import celery_app
from app.models.enums import LenderRequestStatus, VendorRequestStatus
from app.models.report import Report
from app.models.request import ReportRequest, RequestAcceptance


@celery_app.task(name="app.jobs.auto_accept.auto_accept_reports")
def auto_accept_reports():
    """Daily task: auto-accept reports not reviewed within AUTO_ACCEPT_DAYS."""
    import asyncio
    asyncio.run(_auto_accept())


async def _auto_accept():
    async with async_session_factory() as db:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=AUTO_ACCEPT_DAYS)

            result = await db.execute(
                select(ReportRequest).where(
                    ReportRequest.lender_status == LenderRequestStatus.RECEIVED,
                    ReportRequest.updated_at < cutoff,
                )
            )
            requests = list(result.scalars().all())

            for req in requests:
                # Find acceptance and report
                acc_result = await db.execute(
                    select(RequestAcceptance).where(
                        RequestAcceptance.request_id == req.id
                    )
                )
                acceptance = acc_result.scalar_one_or_none()
                if not acceptance:
                    continue

                report_result = await db.execute(
                    select(Report).where(
                        Report.vendor_id == acceptance.vendor_id,
                        Report.is_active == True,
                    ).order_by(Report.created_at.desc())
                )
                report = report_result.scalars().first()
                if not report:
                    continue

                from app.services import request_service
                await request_service.accept_report(
                    db, request=req, report=report, vendor_id=acceptance.vendor_id,
                )

            await db.commit()
        except Exception:
            await db.rollback()
            raise
```

- [ ] **Step 2: Implement broadcast rotation job**

```python
# backend/app/jobs/broadcast_tasks.py
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import async_session_factory
from app.jobs.celery_app import celery_app
from app.models.enums import BroadcastStatus
from app.models.request import ReportRequest, RequestBroadcast


@celery_app.task(name="app.jobs.broadcast_tasks.check_broadcast_rounds")
def check_broadcast_rounds():
    """Every 5 min: expire overdue broadcasts and start next round."""
    import asyncio
    asyncio.run(_check_rounds())


async def _check_rounds():
    async with async_session_factory() as db:
        try:
            now = datetime.now(timezone.utc)

            result = await db.execute(
                select(RequestBroadcast).where(
                    RequestBroadcast.status == BroadcastStatus.ACTIVE,
                    RequestBroadcast.accept_deadline < now,
                )
            )
            expired_broadcasts = list(result.scalars().all())

            for broadcast in expired_broadcasts:
                req_result = await db.execute(
                    select(ReportRequest).where(
                        ReportRequest.id == broadcast.request_id
                    )
                )
                request = req_result.scalar_one_or_none()
                if not request:
                    continue

                from app.services import broadcast_service
                await broadcast_service.advance_broadcast_round(
                    db, request=request, current_broadcast=broadcast,
                )

            await db.commit()
        except Exception:
            await db.rollback()
            raise
```

- [ ] **Step 3: Create `__init__.py` if missing**

Ensure `backend/app/jobs/__init__.py` exists (may already exist).

- [ ] **Step 4: Commit**

```bash
git add backend/app/jobs/auto_accept.py backend/app/jobs/broadcast_tasks.py
git commit -m "feat: implement auto-accept and broadcast rotation Celery tasks"
```

---

## Task 11: Register Routers + Wiring

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Register all new routers in main.py**

Add these imports and router registrations to `backend/app/main.py`:

```python
# Add imports after existing router imports:
from app.api.lender.requests import router as lender_requests_router
from app.api.vendor.requests import router as vendor_requests_router
from app.api.common.polling import router as polling_router
from app.api.common.download import router as download_router

# Add these after existing app.include_router() calls:
app.include_router(lender_requests_router)
app.include_router(vendor_requests_router)
app.include_router(polling_router)
app.include_router(download_router)
```

- [ ] **Step 2: Run all backend tests**

Run: `pytest backend/tests/ -v`
Expected: All tests pass (existing Phase 1-2 tests + new Phase 3 tests).

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register Phase 3 routers (lender requests, vendor requests, polling, download)"
```

---

## Task 12: Frontend TypeScript Types

**Files:**
- Create: `frontend/src/types/request.ts`
- Create: `frontend/src/types/report.ts`
- Create: `frontend/src/types/broadcast.ts`

- [ ] **Step 1: Create request types**

```typescript
// frontend/src/types/request.ts

export type LenderRequestStatus =
  | "DRAFT"
  | "SENT"
  | "AWAITED"
  | "RECEIVED"
  | "ACCEPTED"
  | "SENT_FOR_REVIEW"
  | "REJECTED";

export type VendorRequestStatus =
  | "INCOMING"
  | "DENIED"
  | "PENDING"
  | "SENT"
  | "ACCEPTED"
  | "REVISION";

export type RejectionReason =
  | "LOW_PRICE"
  | "NOT_AVAILABLE"
  | "DO_NOT_WANT_TO_SHARE";

export interface ReportRequest {
  id: string;
  lender_id: string;
  lender_user_id: string;
  branch_id: string | null;
  request_type: "NEW" | "UPDATE" | "NEARBY";
  report_category: "VALUATION" | "LEGAL";
  num_reports_needed: number;
  property_address: string | null;
  property_type: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | "AGRICULTURAL";
  plot_extent_sqft: string | null;
  built_up_sqft: string | null;
  loan_applicant_name: string | null;
  city: string | null;
  area: string | null;
  pin_code: string | null;
  eta_days: number | null;
  price: string | null;
  vendor_specified_id: string | null;
  allow_broadcast_on_reject: boolean;
  parent_report_id: string | null;
  comments: string | null;
  lender_status: LenderRequestStatus;
  vendor_status: VendorRequestStatus | null;
  created_at: string;
  updated_at: string;
}

export interface ReportRequestCreate {
  report_category: "VALUATION" | "LEGAL";
  property_address: string;
  city: string;
  area?: string;
  pin_code?: string;
  property_type: string;
  plot_extent_sqft?: number;
  built_up_sqft?: number;
  loan_applicant_name: string;
  vendor_specified_id?: string;
  allow_broadcast_on_reject?: boolean;
  comments?: string;
}

export interface EligibleVendor {
  id: string;
  name: string;
  city: string | null;
  areas: string[] | null;
}

export interface RequestFilters {
  status?: string;
  report_category?: string;
  property_type?: string;
  page?: number;
  per_page?: number;
}

export interface PollResponse {
  incoming_requests: number;
  updated_requests: number;
  last_checked: string;
}
```

- [ ] **Step 2: Create report types**

```typescript
// frontend/src/types/report.ts

export type ReportStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "ARCHIVED";

export interface Report {
  id: string;
  vendor_id: string;
  report_category: "VALUATION" | "LEGAL";
  status: ReportStatus;
  property_address: string | null;
  macro_location: string | null;
  city: string | null;
  pin_code: string | null;
  property_type: string | null;
  plot_extent_sqft: string | null;
  built_up_sqft: string | null;
  valuation_amount: string | null;
  loan_applicant_name: string | null;
  report_date: string | null;
  expiry_date: string | null;
  uploaded_file_path: string | null;
  listing_approved: boolean;
  is_active: boolean;
}

export interface ReportRevision {
  revision_number: number;
  comments: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Create broadcast types**

```typescript
// frontend/src/types/broadcast.ts

export type BroadcastStatus = "ACTIVE" | "EXPIRED" | "ACCEPTED";

export interface BroadcastInfo {
  id: string;
  broadcast_round: number;
  vendor_count: number;
  accept_deadline: string;
  status: BroadcastStatus;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/request.ts frontend/src/types/report.ts \
  frontend/src/types/broadcast.ts
git commit -m "feat: add TypeScript types for requests, reports, broadcasts"
```

---

## Task 13: API Client Upload Support

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add upload method to api object**

Add this method to the `api` export object in `frontend/src/lib/api.ts`:

```typescript
  upload: <T>(endpoint: string, formData: FormData) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;

    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `API error: ${response.status}`);
      }
      return response.json() as Promise<T>;
    });
  },
```

Note: This intentionally does NOT set `Content-Type` header — the browser will set it automatically with the correct multipart boundary for FormData.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add multipart upload support to API client"
```

---

## Task 14: Polling Hook

**Files:**
- Create: `frontend/src/hooks/use-polling.ts`

- [ ] **Step 1: Create polling hook**

```typescript
// frontend/src/hooks/use-polling.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PollResponse } from "@/types/request";

const POLL_INTERVAL = 30000; // 30 seconds

export function usePolling() {
  const [counts, setCounts] = useState<PollResponse | null>(null);
  const lastCheckedRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      if (!token) return;

      const since = lastCheckedRef.current || "";
      const endpoint = since
        ? `/api/notifications/poll?since=${encodeURIComponent(since)}`
        : "/api/notifications/poll";

      const data = await api.get<PollResponse>(endpoint);
      setCounts(data);
      lastCheckedRef.current = data.last_checked;
    } catch {
      // Silently ignore poll errors
    }
  }, []);

  useEffect(() => {
    // Initial poll
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    // Poll on visibility change (tab focus)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [poll]);

  return {
    incomingRequests: counts?.incoming_requests ?? 0,
    updatedRequests: counts?.updated_requests ?? 0,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/use-polling.ts
git commit -m "feat: add polling hook for request notifications"
```

---

## Task 15: Layout Nav Updates

**Files:**
- Modify: `frontend/src/app/lender/layout.tsx`
- Modify: `frontend/src/app/vendor/layout.tsx`

- [ ] **Step 1: Add Requests nav to lender layout**

In `frontend/src/app/lender/layout.tsx`, add a "Requests" link in both the desktop nav and mobile drawer nav, between Dashboard and Settings:

Desktop sidebar nav section — add between the Dashboard and Settings links:
```tsx
<a href="/lender/requests" className="block px-2 py-3 rounded hover:bg-gray-100">Requests</a>
```

Mobile drawer nav section — add between the Dashboard and Settings links:
```tsx
<a href="/lender/requests" className="block px-2 py-3 rounded hover:bg-gray-100">Requests</a>
```

- [ ] **Step 2: Add Requests nav to vendor layout**

In `frontend/src/app/vendor/layout.tsx`, add a "Requests" link in both nav sections, between Dashboard and Settings:

Desktop sidebar nav section:
```tsx
<a href="/vendor/requests" className="block px-2 py-3 rounded hover:bg-gray-100">Requests</a>
```

Mobile drawer nav section:
```tsx
<a href="/vendor/requests" className="block px-2 py-3 rounded hover:bg-gray-100">Requests</a>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/layout.tsx frontend/src/app/vendor/layout.tsx
git commit -m "feat: add Requests nav links to lender and vendor layouts"
```

---

## Task 16: Lender Requests List Page

**Files:**
- Create: `frontend/src/app/lender/requests/page.tsx`
- Create: `frontend/src/app/lender/requests/_components/request-table.tsx`

- [ ] **Step 1: Create request table component**

```tsx
// frontend/src/app/lender/requests/_components/request-table.tsx
"use client";

import type { ReportRequest } from "@/types/request";

const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-800",
  AWAITED: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-green-100 text-green-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  SENT_FOR_REVIEW: "bg-orange-100 text-orange-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function RequestTable({ requests }: { requests: ReportRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-gray-500 text-center py-8">No requests found.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Property</th>
              <th className="text-left px-4 py-3 font-medium">City</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{r.property_address || "—"}</td>
                <td className="px-4 py-3">{r.city || "—"}</td>
                <td className="px-4 py-3">{r.report_category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.lender_status] || "bg-gray-100"}`}>
                    {r.lender_status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{r.price ? `₹${r.price}` : "—"}</td>
                <td className="px-4 py-3">
                  <a href={`/lender/requests/${r.id}`} className="text-blue-600 hover:underline text-sm">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map((r) => (
          <a
            key={r.id}
            href={`/lender/requests/${r.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-sm">{r.loan_applicant_name || "—"}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.lender_status] || "bg-gray-100"}`}>
                {r.lender_status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{r.city} · {r.report_category}</span>
              <span>{r.price ? `₹${r.price}` : ""}</span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create requests list page**

```tsx
// frontend/src/app/lender/requests/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { RequestTable } from "./_components/request-table";

const TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

export default function LenderRequestsPage() {
  const [requests, setRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = activeTab ? `?status=${activeTab}` : "";
    api
      .get<ReportRequest[]>(`/api/lender/requests/${params}`)
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Requests</h1>
        <a
          href="/lender/requests/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          Raise Request
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.value
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : (
        <RequestTable requests={requests} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build` (or check in Docker)
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/lender/requests/page.tsx \
  frontend/src/app/lender/requests/_components/request-table.tsx
git commit -m "feat: add lender requests list page with tabs and responsive table"
```

---

## Task 17: Lender New Request Form Page

**Files:**
- Create: `frontend/src/app/lender/requests/new/page.tsx`
- Create: `frontend/src/app/lender/requests/new/_components/property-form.tsx`
- Create: `frontend/src/app/lender/requests/new/_components/report-config-form.tsx`
- Create: `frontend/src/app/lender/requests/new/_components/price-confirmation.tsx`

- [ ] **Step 1: Create the multi-step form page**

```tsx
// frontend/src/app/lender/requests/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequestCreate, ReportRequest } from "@/types/request";
import { PropertyForm } from "./_components/property-form";
import { ReportConfigForm } from "./_components/report-config-form";
import { PriceConfirmation } from "./_components/price-confirmation";

type FormData = Partial<ReportRequestCreate>;

export default function NewRequestPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({});
  const [price, setPrice] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateForm = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleStep2Complete = async (data: Partial<FormData>) => {
    updateForm(data);
    setError("");
    // Fetch price preview
    const merged = { ...formData, ...data };
    try {
      const params = new URLSearchParams({
        lender_id: "", // Will be resolved server-side
        report_category: merged.report_category || "",
        city: merged.city || "",
        property_type: merged.property_type || "",
        request_type: "NEW",
        ...(merged.area ? { area: merged.area } : {}),
      });
      // Use admin pricing calculate for preview (or create a lender-side endpoint)
      // For now, we skip preview and show price after creation
      setStep(3);
    } catch {
      setStep(3); // Proceed anyway, price shown after creation
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await api.post<ReportRequest>(
        "/api/lender/requests/",
        formData as ReportRequestCreate,
      );
      router.push(`/lender/requests/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create request");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Raise New Request</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div className={`w-12 h-0.5 ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <PropertyForm
          data={formData}
          onNext={(data) => {
            updateForm(data);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <ReportConfigForm
          data={formData}
          onBack={() => setStep(1)}
          onNext={handleStep2Complete}
        />
      )}

      {step === 3 && (
        <PriceConfirmation
          data={formData as ReportRequestCreate}
          price={price}
          submitting={submitting}
          onBack={() => setStep(2)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create property form component**

```tsx
// frontend/src/app/lender/requests/new/_components/property-form.tsx
"use client";

import { useState } from "react";
import type { ReportRequestCreate } from "@/types/request";

type Props = {
  data: Partial<ReportRequestCreate>;
  onNext: (data: Partial<ReportRequestCreate>) => void;
};

export function PropertyForm({ data, onNext }: Props) {
  const [form, setForm] = useState({
    property_address: data.property_address || "",
    city: data.city || "",
    area: data.area || "",
    pin_code: data.pin_code || "",
    property_type: data.property_type || "RESIDENTIAL",
    plot_extent_sqft: data.plot_extent_sqft?.toString() || "",
    built_up_sqft: data.built_up_sqft?.toString() || "",
    loan_applicant_name: data.loan_applicant_name || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      property_address: form.property_address,
      city: form.city,
      area: form.area || undefined,
      pin_code: form.pin_code || undefined,
      property_type: form.property_type,
      plot_extent_sqft: form.plot_extent_sqft ? Number(form.plot_extent_sqft) : undefined,
      built_up_sqft: form.built_up_sqft ? Number(form.built_up_sqft) : undefined,
      loan_applicant_name: form.loan_applicant_name,
    });
  };

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Property Details</h2>

      <div>
        <label className={labelClass}>Property Address *</label>
        <input className={inputClass} required value={form.property_address}
          onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>City *</label>
          <input className={inputClass} required value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Area</label>
          <input className={inputClass} value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>PIN Code</label>
          <input className={inputClass} value={form.pin_code}
            onChange={(e) => setForm({ ...form, pin_code: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Property Type *</label>
          <select className={inputClass} required value={form.property_type}
            onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="AGRICULTURAL">Agricultural</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Plot Extent (sq ft)</label>
          <input type="number" className={inputClass} value={form.plot_extent_sqft}
            onChange={(e) => setForm({ ...form, plot_extent_sqft: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Built-up Area (sq ft)</label>
          <input type="number" className={inputClass} value={form.built_up_sqft}
            onChange={(e) => setForm({ ...form, built_up_sqft: e.target.value })} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Loan Applicant Name *</label>
        <input className={inputClass} required value={form.loan_applicant_name}
          onChange={(e) => setForm({ ...form, loan_applicant_name: e.target.value })} />
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">
          Next
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create report config form**

```tsx
// frontend/src/app/lender/requests/new/_components/report-config-form.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EligibleVendor, ReportRequestCreate } from "@/types/request";

type Props = {
  data: Partial<ReportRequestCreate>;
  onBack: () => void;
  onNext: (data: Partial<ReportRequestCreate>) => void;
};

export function ReportConfigForm({ data, onBack, onNext }: Props) {
  const [reportCategory, setReportCategory] = useState(data.report_category || "VALUATION");
  const [vendorId, setVendorId] = useState(data.vendor_specified_id || "");
  const [allowBroadcast, setAllowBroadcast] = useState(data.allow_broadcast_on_reject ?? true);
  const [comments, setComments] = useState(data.comments || "");
  const [vendors, setVendors] = useState<EligibleVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  useEffect(() => {
    if (data.city && reportCategory) {
      setLoadingVendors(true);
      const params = new URLSearchParams({
        city: data.city,
        report_category: reportCategory,
        ...(data.area ? { area: data.area } : {}),
      });
      api
        .get<EligibleVendor[]>(`/api/lender/requests/vendors?${params}`)
        .then(setVendors)
        .catch(() => setVendors([]))
        .finally(() => setLoadingVendors(false));
    }
  }, [data.city, data.area, reportCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      report_category: reportCategory as "VALUATION" | "LEGAL",
      vendor_specified_id: vendorId || undefined,
      allow_broadcast_on_reject: allowBroadcast,
      comments: comments || undefined,
    });
  };

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Report Configuration</h2>

      <div>
        <label className={labelClass}>Report Category *</label>
        <select className={inputClass} required value={reportCategory}
          onChange={(e) => setReportCategory(e.target.value)}>
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Preferred Vendor (optional)</label>
        {loadingVendors ? (
          <p className="text-sm text-gray-500">Loading vendors...</p>
        ) : (
          <select className={inputClass} value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Auto-assign (broadcast to area vendors)</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
            ))}
          </select>
        )}
      </div>

      {vendorId && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="allowBroadcast" checked={allowBroadcast}
            onChange={(e) => setAllowBroadcast(e.target.checked)}
            className="rounded border-gray-300" />
          <label htmlFor="allowBroadcast" className="text-sm text-gray-700">
            Broadcast to other vendors if preferred vendor rejects
          </label>
        </div>
      )}

      <div>
        <label className={labelClass}>Comments</label>
        <textarea className={inputClass} rows={3} value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Any additional notes for the vendor..." />
      </div>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack}
          className="border px-6 py-2 rounded-lg text-sm hover:bg-gray-50">
          Back
        </button>
        <button type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">
          Next
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create price confirmation component**

```tsx
// frontend/src/app/lender/requests/new/_components/price-confirmation.tsx
"use client";

import type { ReportRequestCreate } from "@/types/request";

type Props = {
  data: ReportRequestCreate;
  price: string | null;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

export function PriceConfirmation({ data, price, submitting, onBack, onConfirm }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Confirm & Submit</h2>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
        <h3 className="font-medium text-gray-900">Request Summary</h3>
        <div className="grid grid-cols-2 gap-2 text-gray-700">
          <span className="text-gray-500">Property:</span>
          <span>{data.property_address}</span>
          <span className="text-gray-500">City:</span>
          <span>{data.city}{data.area ? `, ${data.area}` : ""}</span>
          <span className="text-gray-500">Type:</span>
          <span>{data.property_type}</span>
          <span className="text-gray-500">Category:</span>
          <span>{data.report_category}</span>
          <span className="text-gray-500">Applicant:</span>
          <span>{data.loan_applicant_name}</span>
          <span className="text-gray-500">Vendor:</span>
          <span>{data.vendor_specified_id ? "Specified" : "Auto-assign (broadcast)"}</span>
        </div>
      </div>

      {price && (
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-600">Estimated Price</p>
          <p className="text-2xl font-bold text-blue-900">₹{price}</p>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Price will be calculated based on your lender&apos;s pricing configuration.
        The final price will be shown after submission.
      </p>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} disabled={submitting}
          className="border px-6 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
          Back
        </button>
        <button onClick={onConfirm} disabled={submitting}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lender/requests/new/
git commit -m "feat: add lender raise request multi-step form"
```

---

## Task 18: Lender Request Detail Page

**Files:**
- Create: `frontend/src/app/lender/requests/[id]/page.tsx`
- Create: `frontend/src/app/lender/requests/[id]/_components/status-timeline.tsx`

- [ ] **Step 1: Create status timeline component**

```tsx
// frontend/src/app/lender/requests/[id]/_components/status-timeline.tsx
"use client";

import type { LenderRequestStatus } from "@/types/request";

const STEPS: { status: LenderRequestStatus; label: string }[] = [
  { status: "SENT", label: "Sent" },
  { status: "AWAITED", label: "Awaited" },
  { status: "RECEIVED", label: "Received" },
  { status: "ACCEPTED", label: "Accepted" },
];

const STATUS_ORDER: Record<string, number> = {
  SENT: 0, AWAITED: 1, RECEIVED: 2, ACCEPTED: 3,
  SENT_FOR_REVIEW: 2, REJECTED: -1,
};

export function StatusTimeline({ status }: { status: LenderRequestStatus }) {
  const currentIndex = STATUS_ORDER[status] ?? -1;

  return (
    <>
      {/* Desktop horizontal */}
      <div className="hidden sm:flex items-center gap-2 mb-6">
        {STEPS.map((step, i) => (
          <div key={step.status} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= currentIndex
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {i <= currentIndex ? "✓" : i + 1}
              </div>
              <span className="text-xs mt-1 text-gray-600">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mb-5 ${i < currentIndex ? "bg-green-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Mobile vertical */}
      <div className="sm:hidden space-y-3 mb-6">
        {STEPS.map((step, i) => (
          <div key={step.status} className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                i <= currentIndex ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {i <= currentIndex ? "✓" : i + 1}
            </div>
            <span className={`text-sm ${i <= currentIndex ? "font-medium" : "text-gray-500"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {status === "SENT_FOR_REVIEW" && (
        <div className="bg-orange-50 text-orange-800 text-sm px-4 py-2 rounded mb-4">
          Report sent back for revision — awaiting vendor resubmission
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create request detail page**

```tsx
// frontend/src/app/lender/requests/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { StatusTimeline } from "./_components/status-timeline";

export default function LenderRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComments, setRejectComments] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<ReportRequest>(`/api/lender/requests/${id}`)
      .then(setRequest)
      .catch(() => setError("Request not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAccept = async () => {
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/lender/requests/${id}/accept`, {});
      setRequest((prev) => prev ? { ...prev, lender_status: "ACCEPTED", vendor_status: "ACCEPTED" } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectComments.trim()) return;
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/lender/requests/${id}/reject`, { comments: rejectComments });
      setRequest((prev) => prev ? { ...prev, lender_status: "SENT_FOR_REVIEW", vendor_status: "REVISION" } : prev);
      setShowRejectDialog(false);
      setRejectComments("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-gray-500 py-8">Loading...</p>;
  if (!request) return <p className="text-red-500 py-8">{error || "Request not found"}</p>;

  const canAcceptReject = request.lender_status === "RECEIVED";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.push("/lender/requests")}
        className="text-sm text-blue-600 hover:underline mb-4 block">&larr; Back to Requests</button>

      <h1 className="text-2xl font-bold mb-4">Request Detail</h1>

      <StatusTimeline status={request.lender_status} />

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
      )}

      {/* Property Details */}
      <div className="border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Property Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Address:</span> {request.property_address || "—"}</div>
          <div><span className="text-gray-500">City:</span> {request.city}{request.area ? `, ${request.area}` : ""}</div>
          <div><span className="text-gray-500">Type:</span> {request.property_type}</div>
          <div><span className="text-gray-500">Category:</span> {request.report_category}</div>
          <div><span className="text-gray-500">Applicant:</span> {request.loan_applicant_name || "—"}</div>
          <div><span className="text-gray-500">Price:</span> {request.price ? `₹${request.price}` : "—"}</div>
        </div>
      </div>

      {/* Report Actions */}
      {canAcceptReject && (
        <div className="border rounded-lg p-4 mb-4 bg-green-50">
          <h2 className="font-semibold mb-3">Report Uploaded</h2>
          <p className="text-sm text-gray-700 mb-4">The vendor has uploaded a report. You can accept or send it back for revision.</p>
          <div className="flex gap-3">
            <button onClick={handleAccept} disabled={actionLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              {actionLoading ? "Processing..." : "Accept Report"}
            </button>
            <button onClick={() => setShowRejectDialog(true)} disabled={actionLoading}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50">
              Send Back for Revision
            </button>
            <a href={`/api/reports/${id}/download`} target="_blank" rel="noopener noreferrer"
              className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Download PDF
            </a>
          </div>
        </div>
      )}

      {request.lender_status === "ACCEPTED" && (
        <div className="border rounded-lg p-4 mb-4 bg-emerald-50">
          <p className="text-emerald-800 font-medium">Report accepted. Billing entries created.</p>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold mb-3">Send Back for Revision</h3>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
              rows={4}
              placeholder="Describe what needs to be revised..."
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectDialog(false)}
                className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading || !rejectComments.trim()}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? "Sending..." : "Send Back"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/requests/\\[id\\]/
git commit -m "feat: add lender request detail page with status timeline and accept/reject"
```

---

## Task 19: Vendor Requests List Page

**Files:**
- Create: `frontend/src/app/vendor/requests/page.tsx`
- Create: `frontend/src/app/vendor/requests/_components/request-table.tsx`

- [ ] **Step 1: Create vendor request table component**

```tsx
// frontend/src/app/vendor/requests/_components/request-table.tsx
"use client";

import type { ReportRequest } from "@/types/request";

const STATUS_COLORS: Record<string, string> = {
  INCOMING: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  REVISION: "bg-orange-100 text-orange-800",
  SENT: "bg-green-100 text-green-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  DENIED: "bg-red-100 text-red-800",
};

export function VendorRequestTable({ requests }: { requests: ReportRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-gray-500 text-center py-8">No requests found.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Applicant</th>
              <th className="text-left px-4 py-3 font-medium">City</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{r.loan_applicant_name || "—"}</td>
                <td className="px-4 py-3">{r.city || "—"}</td>
                <td className="px-4 py-3">{r.report_category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.vendor_status || ""] || "bg-gray-100"}`}>
                    {(r.vendor_status || "—").replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{r.price ? `₹${r.price}` : "—"}</td>
                <td className="px-4 py-3">
                  <a href={`/vendor/requests/${r.id}`} className="text-blue-600 hover:underline text-sm">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map((r) => (
          <a key={r.id} href={`/vendor/requests/${r.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-sm">{r.loan_applicant_name || "—"}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.vendor_status || ""] || "bg-gray-100"}`}>
                {(r.vendor_status || "—").replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{r.city} · {r.report_category}</span>
              <span>{r.price ? `₹${r.price}` : ""}</span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create vendor requests list page**

```tsx
// frontend/src/app/vendor/requests/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { VendorRequestTable } from "./_components/request-table";

const TABS = [
  { label: "Incoming", value: "incoming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
];

export default function VendorRequestsPage() {
  const [requests, setRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("incoming");

  useEffect(() => {
    setLoading(true);
    api
      .get<ReportRequest[]>(`/api/vendor/requests/?status=${activeTab}`)
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Requests</h1>

      <div className="flex gap-1 mb-4 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.value
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : (
        <VendorRequestTable requests={requests} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/vendor/requests/page.tsx \
  frontend/src/app/vendor/requests/_components/request-table.tsx
git commit -m "feat: add vendor requests list page with tabs"
```

---

## Task 20: Vendor Request Detail Page

**Files:**
- Create: `frontend/src/app/vendor/requests/[id]/page.tsx`
- Create: `frontend/src/app/vendor/requests/[id]/_components/upload-section.tsx`

- [ ] **Step 1: Create upload section component**

```tsx
// frontend/src/app/vendor/requests/[id]/_components/upload-section.tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Report } from "@/types/report";

type Props = {
  requestId: string;
  isRevision?: boolean;
  onUploaded: () => void;
};

export function UploadSection({ requestId, isRevision = false, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [valuationAmount, setValuationAmount] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [comments, setComments] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    if (valuationAmount) formData.append("valuation_amount", valuationAmount);
    if (reportDate) formData.append("report_date", reportDate);
    if (isRevision && comments) formData.append("comments", comments);

    try {
      const endpoint = isRevision
        ? `/api/vendor/requests/${requestId}/revise`
        : `/api/vendor/requests/${requestId}/upload`;
      await api.upload<Report>(endpoint, formData);
      onUploaded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm";

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold">
        {isRevision ? "Re-upload Revised Report" : "Upload Report"}
      </h3>

      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Report PDF *</label>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">PDF only, max 20MB</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Amount</label>
          <input type="number" className={inputClass} value={valuationAmount}
            onChange={(e) => setValuationAmount(e.target.value)} placeholder="e.g. 5000000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Date</label>
          <input type="date" className={inputClass} value={reportDate}
            onChange={(e) => setReportDate(e.target.value)} />
        </div>
      </div>

      {isRevision && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Revision Comments</label>
          <textarea className={inputClass} rows={3} value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Describe what was changed..." />
        </div>
      )}

      <button onClick={handleUpload} disabled={!file || uploading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
        {uploading ? "Uploading..." : isRevision ? "Submit Revision" : "Upload Report"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create vendor request detail page**

```tsx
// frontend/src/app/vendor/requests/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequest, RejectionReason } from "@/types/request";
import { UploadSection } from "./_components/upload-section";

const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: "LOW_PRICE", label: "Price too low" },
  { value: "NOT_AVAILABLE", label: "Not available" },
  { value: "DO_NOT_WANT_TO_SHARE", label: "Don't want to share" },
];

export default function VendorRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason>("LOW_PRICE");
  const [error, setError] = useState("");

  const fetchRequest = () => {
    api
      .get<ReportRequest>(`/api/vendor/requests/${id}`)
      .then(setRequest)
      .catch(() => setError("Request not found"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequest(); }, [id]);

  const handleAccept = async () => {
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/vendor/requests/${id}/accept`, {});
      setRequest((prev) => prev ? { ...prev, vendor_status: "PENDING", lender_status: "AWAITED" } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/vendor/requests/${id}/reject`, { reason: rejectReason });
      setShowRejectDialog(false);
      router.push("/vendor/requests");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-gray-500 py-8">Loading...</p>;
  if (!request) return <p className="text-red-500 py-8">{error || "Request not found"}</p>;

  const isIncoming = request.vendor_status === "INCOMING";
  const isPending = request.vendor_status === "PENDING";
  const isRevision = request.vendor_status === "REVISION";
  const isCompleted = request.vendor_status === "SENT" || request.vendor_status === "ACCEPTED";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.push("/vendor/requests")}
        className="text-sm text-blue-600 hover:underline mb-4 block">&larr; Back to Requests</button>

      <h1 className="text-2xl font-bold mb-4">Request Detail</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
      )}

      {/* Property Details */}
      <div className="border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Property Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Address:</span> {request.property_address || "—"}</div>
          <div><span className="text-gray-500">City:</span> {request.city}{request.area ? `, ${request.area}` : ""}</div>
          <div><span className="text-gray-500">Type:</span> {request.property_type}</div>
          <div><span className="text-gray-500">Category:</span> {request.report_category}</div>
          <div><span className="text-gray-500">Applicant:</span> {request.loan_applicant_name || "—"}</div>
          <div><span className="text-gray-500">Price:</span> {request.price ? `₹${request.price}` : "—"}</div>
        </div>
        {request.comments && (
          <div className="mt-3 pt-3 border-t">
            <span className="text-gray-500 text-sm">Comments:</span>
            <p className="text-sm mt-1">{request.comments}</p>
          </div>
        )}
      </div>

      {/* Incoming: Accept/Reject */}
      {isIncoming && (
        <div className="border rounded-lg p-4 mb-4 bg-blue-50">
          <h2 className="font-semibold mb-3">Action Required</h2>
          <p className="text-sm text-gray-700 mb-4">You have a new request. Accept to proceed or reject with a reason.</p>
          <div className="flex gap-3">
            <button onClick={handleAccept} disabled={actionLoading}
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              {actionLoading ? "Processing..." : "Accept"}
            </button>
            <button onClick={() => setShowRejectDialog(true)} disabled={actionLoading}
              className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Pending: Upload */}
      {isPending && (
        <UploadSection requestId={id} onUploaded={fetchRequest} />
      )}

      {/* Revision: Re-upload */}
      {isRevision && (
        <>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-orange-800 mb-2">Revision Requested</h3>
            <p className="text-sm text-orange-700">The lender has requested revisions. Please re-upload an updated report.</p>
          </div>
          <UploadSection requestId={id} isRevision onUploaded={fetchRequest} />
        </>
      )}

      {/* Completed */}
      {isCompleted && (
        <div className="border rounded-lg p-4 mb-4 bg-emerald-50">
          <p className="text-emerald-800 font-medium">
            {request.vendor_status === "ACCEPTED" ? "Report accepted by lender." : "Report submitted."}
          </p>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold mb-3">Reject Request</h3>
            <div className="space-y-2 mb-4">
              {REJECTION_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={r.value}
                    checked={rejectReason === r.value}
                    onChange={() => setRejectReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
            {rejectReason === "LOW_PRICE" && (
              <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded mb-4">
                Consider discussing pricing with the lender before rejecting.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectDialog(false)}
                className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/vendor/requests/\\[id\\]/
git commit -m "feat: add vendor request detail page with accept/reject/upload/revise"
```

---

## Task 21: Seed Data Updates

**Files:**
- Modify: `backend/scripts/seed.py`

- [ ] **Step 1: Add service areas to seed script**

Add service area creation for the seed vendor so broadcast can find vendors. In `backend/scripts/seed.py`, after vendor creation, add:

```python
# After creating the vendor, add service areas
from app.models.vendor import ServiceArea
from app.models.enums import ServiceType

valuation_area = ServiceArea(
    vendor_id=vendor.id,
    city="Bengaluru",
    areas=["Koramangala", "Indiranagar", "Jayanagar", "HSR Layout"],
    service_type=ServiceType.VALUATION,
)
db.add(valuation_area)

legal_area = ServiceArea(
    vendor_id=vendor.id,
    city="Bengaluru",
    areas=None,  # City-wide legal services
    service_type=ServiceType.LEGAL,
)
db.add(legal_area)
```

This ensures `make seed` creates data that supports end-to-end testing of the broadcast flow.

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/seed.py
git commit -m "feat: add service areas to seed data for broadcast testing"
```

---

## Task 22: End-to-End Verification

- [ ] **Step 1: Rebuild and migrate**

```bash
make local-down && make local-up
make migrate
make seed
```

- [ ] **Step 2: Run all backend tests**

```bash
# Copy test files into container (tests dir not volume-mounted)
docker compose -f docker-compose.local.yml cp backend/tests/. backend:/app/tests/
docker compose -f docker-compose.local.yml exec backend pytest tests/ -v
```

Expected: All tests pass (Phase 1-2 + Phase 3).

- [ ] **Step 3: Verify frontend builds**

```bash
docker compose -f docker-compose.local.yml exec frontend npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual API smoke test**

```bash
# Login as lender
TOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lender@abcl.com","password":"lender123"}' | jq -r '.access_token')

# Get eligible vendors
curl -s http://localhost:8020/api/lender/requests/vendors?city=Bengaluru&report_category=VALUATION \
  -H "Authorization: Bearer $TOKEN" | jq

# Create a request
curl -s -X POST http://localhost:8020/api/lender/requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"report_category":"VALUATION","property_address":"123 5th Main, Koramangala","city":"Bengaluru","area":"Koramangala","property_type":"RESIDENTIAL","loan_applicant_name":"Test Applicant"}' | jq

# List requests
curl -s http://localhost:8020/api/lender/requests/ \
  -H "Authorization: Bearer $TOKEN" | jq
```

- [ ] **Step 5: Update CLAUDE.md**

Add Phase 3 status to the Current Status section. Update endpoint count. Add any new gotchas discovered during implementation.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Phase 3 completion status"
```
