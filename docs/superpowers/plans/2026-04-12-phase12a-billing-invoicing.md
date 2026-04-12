# Phase 12A: Billing & Invoicing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the billing loop with monthly invoice generation, lifecycle management, admin billing page, and enhanced vendor/lender billing views.

**Architecture:** Monthly Celery job aggregates VendorEarning/LenderPayable entries into Invoice records with structured numbering. Admin manages lifecycle (PENDING → BILLED → PAID) via a dedicated billing page. Vendor and lender dashboards gain drill-down detail and CSV exports.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Celery Beat, Alembic, Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Recharts

**Spec:** `docs/superpowers/specs/2026-04-12-phase12a-billing-invoicing-design.md`

---

### Task 1: Invoice model updates + migration

**Files:**
- Modify: `backend/app/models/billing.py:48-63`
- Modify: `backend/app/models/enums.py:138-157` and `126-136` and `166-173`
- Modify: `backend/app/models/__init__.py`
- Create: Alembic migration

- [ ] **Step 1: Add new fields to Invoice model**

In `backend/app/models/billing.py`, add three new columns to the Invoice class:

```python
# Add to imports at top (line 5):
from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)

# Add to Invoice class after generated_at (after line 62):
    invoice_number: Mapped[str | None] = mapped_column(
        String(30), unique=True, nullable=True
    )
    line_items_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Add new enum values**

In `backend/app/models/enums.py`, add two values to ActivityAction (after line 156):

```python
    INVOICE_GENERATED = "INVOICE_GENERATED"
    INVOICE_STATUS_UPDATED = "INVOICE_STATUS_UPDATED"
```

Add new notification event types (after line 131):

```python
    INVOICE_GENERATED = "INVOICE_GENERATED"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
```

Add new notification reference type (after line 136):

```python
    INVOICE = "INVOICE"
```

Add new activity target type (after line 173):

```python
    INVOICE = "INVOICE"
```

- [ ] **Step 3: Generate Alembic migration**

```bash
cd backend && poetry run alembic revision --autogenerate -m "add invoice_number line_items_count notes to invoices"
```

Verify the generated migration adds `invoice_number` (String(30), unique, nullable), `line_items_count` (Integer, default=0), and `notes` (Text, nullable) to the `invoices` table.

- [ ] **Step 4: Run migration**

```bash
make migrate
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/billing.py backend/app/models/enums.py backend/alembic/versions/
git commit -m "feat(phase12a): add invoice model fields and billing enums"
```

---

### Task 2: Billing Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/billing.py:1-44`

- [ ] **Step 1: Extend billing schemas**

Replace the contents of `backend/app/schemas/billing.py` with:

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
    invoice_number: str | None = None
    line_items_count: int = 0
    notes: str | None = None


class InvoiceWithOrgResponse(InvoiceResponse):
    org_name: str = ""


class InvoiceStatusUpdate(BaseModel):
    status: str  # PaymentStatus value: BILLED or PAID


class BulkStatusUpdate(BaseModel):
    invoice_ids: list[UUID]
    status: str  # PaymentStatus value


class GenerateInvoicesRequest(BaseModel):
    month: str  # Format: YYYY-MM


class BillingEntryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_id: UUID
    request_id: UUID | None = None
    amount: Decimal
    entry_type: str
    created_at: datetime


class BillingEntriesWithInvoice(BaseModel):
    entries: list[BillingEntryResponse]
    invoice_number: str | None = None
    invoice_status: str | None = None


class InvoiceDetailResponse(InvoiceWithOrgResponse):
    entries: list[BillingEntryResponse] = []
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/billing.py
git commit -m "feat(phase12a): extend billing schemas with invoice and entry types"
```

---

### Task 3: Billing service — invoice generation and management

**Files:**
- Modify: `backend/app/services/billing_service.py:1-86`

- [ ] **Step 1: Add invoice generation and management functions**

Append the following functions to `backend/app/services/billing_service.py`. First update the imports at the top of the file:

```python
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.billing import Invoice, LenderPayable, VendorEarning
from app.models.enums import (
    EarningType,
    InvoiceType,
    PayableType,
    PaymentStatus,
)
from app.models.lender import Lender
from app.models.report import Report
from app.models.request import ReportRequest
from app.models.user import Organization
from app.models.vendor import Vendor
```

Then add these functions after the existing `create_listing_purchase_entries` function:

```python
VALID_TRANSITIONS = {
    PaymentStatus.PENDING: {PaymentStatus.BILLED},
    PaymentStatus.BILLED: {PaymentStatus.PAID},
    PaymentStatus.PAID: {PaymentStatus.BILLED},
}


async def generate_invoice_number(
    db: AsyncSession, invoice_type: InvoiceType, month: str
) -> str:
    prefix = "GTR-PAY" if invoice_type == InvoiceType.PAYABLE else "GTR-RCV"
    pattern = f"{prefix}-{month}-%"

    result = await db.execute(
        select(Invoice.invoice_number)
        .where(Invoice.invoice_number.like(pattern))
        .order_by(Invoice.invoice_number.desc())
        .limit(1)
    )
    last_number = result.scalar_one_or_none()

    if last_number:
        seq = int(last_number.split("-")[-1]) + 1
    else:
        seq = 1

    return f"{prefix}-{month}-{seq:04d}"


async def generate_invoices_for_month(
    db: AsyncSession, month: str
) -> list[Invoice]:
    existing = await db.execute(
        select(Invoice).where(Invoice.month == month)
    )
    if existing.scalars().first():
        all_invoices = await db.execute(
            select(Invoice).where(Invoice.month == month)
        )
        return list(all_invoices.scalars().all())

    invoices: list[Invoice] = []

    vendor_agg = await db.execute(
        select(
            VendorEarning.vendor_id,
            func.sum(VendorEarning.amount).label("total"),
            func.count().label("cnt"),
        )
        .where(VendorEarning.month == month)
        .group_by(VendorEarning.vendor_id)
    )
    for row in vendor_agg.all():
        vendor = await db.execute(
            select(Organization.id).join(
                Vendor,
                Organization.id == Vendor.organization_id,
            ).where(
                Vendor.id == row.vendor_id
            )
        )
        org_id_result = vendor.scalar_one_or_none()
        if not org_id_result:
            continue

        inv_number = await generate_invoice_number(db, InvoiceType.RECEIVABLE, month)
        invoice = Invoice(
            invoice_type=InvoiceType.RECEIVABLE,
            organization_id=org_id_result,
            amount=row.total,
            status=PaymentStatus.PENDING,
            month=month,
            generated_at=datetime.utcnow(),
            invoice_number=inv_number,
            line_items_count=row.cnt,
        )
        db.add(invoice)
        invoices.append(invoice)

    lender_agg = await db.execute(
        select(
            LenderPayable.lender_id,
            func.sum(LenderPayable.amount).label("total"),
            func.count().label("cnt"),
        )
        .where(LenderPayable.month == month)
        .group_by(LenderPayable.lender_id)
    )
    for row in lender_agg.all():
        lender = await db.execute(
            select(Organization.id).join(
                Lender,
                Organization.id == Lender.organization_id,
            ).where(
                Lender.id == row.lender_id
            )
        )
        org_id_result = lender.scalar_one_or_none()
        if not org_id_result:
            continue

        inv_number = await generate_invoice_number(db, InvoiceType.PAYABLE, month)
        invoice = Invoice(
            invoice_type=InvoiceType.PAYABLE,
            organization_id=org_id_result,
            amount=row.total,
            status=PaymentStatus.PENDING,
            month=month,
            generated_at=datetime.utcnow(),
            invoice_number=inv_number,
            line_items_count=row.cnt,
        )
        db.add(invoice)
        invoices.append(invoice)

    await db.flush()
    return invoices


async def get_invoices(
    db: AsyncSession,
    *,
    month: str | None = None,
    invoice_type: InvoiceType | None = None,
    status: PaymentStatus | None = None,
) -> list[Invoice]:
    stmt = select(Invoice).order_by(Invoice.created_at.desc())
    if month:
        stmt = stmt.where(Invoice.month == month)
    if invoice_type:
        stmt = stmt.where(Invoice.invoice_type == invoice_type)
    if status:
        stmt = stmt.where(Invoice.status == status)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_invoice_by_id(db: AsyncSession, invoice_id: UUID) -> Invoice | None:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    return result.scalar_one_or_none()


async def get_invoice_entries(
    db: AsyncSession, invoice: Invoice
) -> list[dict]:
    if invoice.invoice_type == InvoiceType.RECEIVABLE:
        vendor_result = await db.execute(
            select(
                Vendor.id
            ).join(
                Organization,
                Vendor.organization_id == Organization.id,
            ).where(Organization.id == invoice.organization_id)
        )
        vendor_id = vendor_result.scalar_one_or_none()
        if not vendor_id:
            return []
        result = await db.execute(
            select(VendorEarning)
            .where(
                VendorEarning.vendor_id == vendor_id,
                VendorEarning.month == invoice.month,
            )
            .order_by(VendorEarning.created_at.desc())
        )
        entries = result.scalars().all()
        return [
            {
                "id": str(e.id),
                "report_id": str(e.report_id),
                "request_id": str(e.request_id) if e.request_id else None,
                "amount": str(e.amount),
                "entry_type": e.earning_type.value,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]
    else:
        result = await db.execute(
            select(
                Lender.id
            ).join(
                Organization,
                Lender.organization_id == Organization.id,
            ).where(Organization.id == invoice.organization_id)
        )
        lender_id = result.scalar_one_or_none()
        if not lender_id:
            return []
        result = await db.execute(
            select(LenderPayable)
            .where(
                LenderPayable.lender_id == lender_id,
                LenderPayable.month == invoice.month,
            )
            .order_by(LenderPayable.created_at.desc())
        )
        entries = result.scalars().all()
        return [
            {
                "id": str(e.id),
                "report_id": str(e.report_id),
                "request_id": str(e.request_id) if e.request_id else None,
                "amount": str(e.amount),
                "entry_type": e.payable_type.value,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]


async def update_invoice_status(
    db: AsyncSession, invoice_id: UUID, new_status_str: str
) -> Invoice | None:
    invoice = await get_invoice_by_id(db, invoice_id)
    if not invoice:
        return None

    new_status = PaymentStatus(new_status_str)
    current = invoice.status
    if new_status not in VALID_TRANSITIONS.get(current, set()):
        raise ValueError(
            f"Invalid transition from {current.value} to {new_status.value}"
        )

    invoice.status = new_status
    await db.flush()
    return invoice


async def bulk_update_invoice_status(
    db: AsyncSession, invoice_ids: list[UUID], new_status_str: str
) -> dict:
    new_status = PaymentStatus(new_status_str)
    updated = []
    skipped = []

    for inv_id in invoice_ids:
        invoice = await get_invoice_by_id(db, inv_id)
        if not invoice:
            skipped.append(str(inv_id))
            continue
        if new_status not in VALID_TRANSITIONS.get(invoice.status, set()):
            skipped.append(str(inv_id))
            continue
        invoice.status = new_status
        updated.append(str(inv_id))

    await db.flush()
    return {"updated": updated, "skipped": skipped}


async def get_org_billing_entries(
    db: AsyncSession,
    *,
    org_id: UUID,
    month: str,
    entry_type: str,
) -> dict:
    if entry_type == "earning":
        vendor_result = await db.execute(
            select(
                Vendor.id
            ).join(
                Organization,
                Vendor.organization_id == Organization.id,
            ).where(Organization.id == org_id)
        )
        entity_id = vendor_result.scalar_one_or_none()
        if not entity_id:
            return {"entries": [], "invoice_number": None, "invoice_status": None}

        result = await db.execute(
            select(VendorEarning)
            .where(VendorEarning.vendor_id == entity_id, VendorEarning.month == month)
            .order_by(VendorEarning.created_at.desc())
        )
        entries = [
            {
                "id": str(e.id),
                "report_id": str(e.report_id),
                "request_id": str(e.request_id) if e.request_id else None,
                "amount": str(e.amount),
                "entry_type": e.earning_type.value,
                "created_at": e.created_at.isoformat(),
            }
            for e in result.scalars().all()
        ]
    else:
        lender_result = await db.execute(
            select(
                Lender.id
            ).join(
                Organization,
                Lender.organization_id == Organization.id,
            ).where(Organization.id == org_id)
        )
        entity_id = lender_result.scalar_one_or_none()
        if not entity_id:
            return {"entries": [], "invoice_number": None, "invoice_status": None}

        result = await db.execute(
            select(LenderPayable)
            .where(LenderPayable.lender_id == entity_id, LenderPayable.month == month)
            .order_by(LenderPayable.created_at.desc())
        )
        entries = [
            {
                "id": str(e.id),
                "report_id": str(e.report_id),
                "request_id": str(e.request_id) if e.request_id else None,
                "amount": str(e.amount),
                "entry_type": e.payable_type.value,
                "created_at": e.created_at.isoformat(),
            }
            for e in result.scalars().all()
        ]

    inv_type = InvoiceType.RECEIVABLE if entry_type == "earning" else InvoiceType.PAYABLE
    inv_result = await db.execute(
        select(Invoice).where(
            Invoice.organization_id == org_id,
            Invoice.month == month,
            Invoice.invoice_type == inv_type,
        )
    )
    invoice = inv_result.scalar_one_or_none()

    return {
        "entries": entries,
        "invoice_number": invoice.invoice_number if invoice else None,
        "invoice_status": invoice.status.value if invoice else None,
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/billing_service.py
git commit -m "feat(phase12a): add invoice generation, status management, and query functions"
```

---

### Task 4: Celery billing task + beat schedule

**Files:**
- Create: `backend/app/jobs/billing_tasks.py`
- Modify: `backend/app/jobs/celery_app.py:24-33`

- [ ] **Step 1: Create billing Celery task**

Create `backend/app/jobs/billing_tasks.py`:

```python
import asyncio
from datetime import datetime, timedelta

from app.core.database import get_async_session_context
from app.jobs.celery_app import celery_app


@celery_app.task(
    name="app.jobs.billing_tasks.generate_monthly_invoices",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_monthly_invoices(self):
    try:
        asyncio.run(_generate())
    except Exception as exc:
        self.retry(exc=exc)


async def _generate():
    from app.services import billing_service

    now = datetime.utcnow()
    first_of_month = now.replace(day=1)
    prev_month = first_of_month - timedelta(days=1)
    month = prev_month.strftime("%Y-%m")

    async with get_async_session_context() as db:
        invoices = await billing_service.generate_invoices_for_month(db, month)

        if invoices:
            from app.services.notification_service import create_notification
            from app.services.activity_log_service import log_activity
            from app.models.enums import (
                NotificationEventType,
                NotificationReferenceType,
            )
            from app.models.user import User
            from sqlalchemy import select

            for invoice in invoices:
                await log_activity(
                    db,
                    actor_id=None,
                    actor_type="SYSTEM",
                    action="INVOICE_GENERATED",
                    target_type="INVOICE",
                    target_id=invoice.id,
                    metadata={
                        "invoice_number": invoice.invoice_number,
                        "amount": str(invoice.amount),
                        "month": invoice.month,
                        "type": invoice.invoice_type.value,
                    },
                )

                users_result = await db.execute(
                    select(User).where(User.organization_id == invoice.organization_id)
                )
                for user in users_result.scalars().all():
                    await create_notification(
                        db,
                        user_id=user.id,
                        event_type=NotificationEventType.INVOICE_GENERATED,
                        title="Invoice Generated",
                        message=f"Your invoice for {invoice.month} has been generated: {invoice.invoice_number}, Amount: ₹{invoice.amount}",
                        reference_id=invoice.id,
                        reference_type=NotificationReferenceType.INVOICE,
                    )
```

- [ ] **Step 2: Add to Celery Beat schedule**

In `backend/app/jobs/celery_app.py`, add to the beat_schedule dict (after the "broadcast-rotation" entry):

```python
    "generate-monthly-invoices": {
        "task": "app.jobs.billing_tasks.generate_monthly_invoices",
        "schedule": crontab(day_of_month=1, hour=2, minute=0),
    },
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/jobs/billing_tasks.py backend/app/jobs/celery_app.py
git commit -m "feat(phase12a): add monthly invoice generation Celery task and beat schedule"
```

---

### Task 5: Admin billing API endpoints

**Files:**
- Create: `backend/app/api/admin/billing.py`
- Modify: `backend/app/main.py:1-80`

- [ ] **Step 1: Create admin billing router**

Create `backend/app/api/admin/billing.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.enums import InvoiceType, PaymentStatus
from app.models.user import Organization, User
from app.schemas.billing import (
    BulkStatusUpdate,
    GenerateInvoicesRequest,
    InvoiceDetailResponse,
    InvoiceStatusUpdate,
    InvoiceWithOrgResponse,
)
from app.services import billing_service
from app.services.activity_log_service import log_activity
from app.services.csv_export_service import generate_csv_response

router = APIRouter(prefix="/api/admin/billing", tags=["admin-billing"])


@router.get("/invoices", response_model=list[InvoiceWithOrgResponse])
async def list_invoices(
    month: str | None = Query(None),
    invoice_type: str | None = Query(None),
    invoice_status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    type_enum = InvoiceType(invoice_type) if invoice_type else None
    status_enum = PaymentStatus(invoice_status) if invoice_status else None

    invoices = await billing_service.get_invoices(
        db, month=month, invoice_type=type_enum, status=status_enum
    )

    results = []
    for inv in invoices:
        from sqlalchemy import select

        org = await db.execute(
            select(Organization.name).where(Organization.id == inv.organization_id)
        )
        org_name = org.scalar_one_or_none() or ""
        results.append(
            InvoiceWithOrgResponse(
                id=inv.id,
                invoice_type=inv.invoice_type.value,
                organization_id=inv.organization_id,
                amount=inv.amount,
                status=inv.status.value,
                month=inv.month,
                generated_at=inv.generated_at,
                invoice_number=inv.invoice_number,
                line_items_count=inv.line_items_count,
                notes=inv.notes,
                org_name=org_name,
            )
        )
    return results


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice_detail(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    invoice = await billing_service.get_invoice_by_id(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    entries = await billing_service.get_invoice_entries(db, invoice)

    from sqlalchemy import select

    org = await db.execute(
        select(Organization.name).where(Organization.id == invoice.organization_id)
    )
    org_name = org.scalar_one_or_none() or ""

    return InvoiceDetailResponse(
        id=invoice.id,
        invoice_type=invoice.invoice_type.value,
        organization_id=invoice.organization_id,
        amount=invoice.amount,
        status=invoice.status.value,
        month=invoice.month,
        generated_at=invoice.generated_at,
        invoice_number=invoice.invoice_number,
        line_items_count=invoice.line_items_count,
        notes=invoice.notes,
        org_name=org_name,
        entries=entries,
    )


@router.patch("/invoices/{invoice_id}/status")
async def update_status(
    invoice_id: UUID,
    body: InvoiceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    try:
        invoice = await billing_service.update_invoice_status(
            db, invoice_id, body.status
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    await log_activity(
        db,
        actor_id=current_user.id,
        actor_type="ADMIN",
        action="INVOICE_STATUS_UPDATED",
        target_type="INVOICE",
        target_id=invoice.id,
        metadata={
            "invoice_number": invoice.invoice_number,
            "new_status": body.status,
        },
    )

    if body.status == "PAID":
        from app.models.enums import (
            NotificationEventType,
            NotificationReferenceType,
        )
        from app.services.notification_service import create_notification
        from sqlalchemy import select

        users_result = await db.execute(
            select(User).where(User.organization_id == invoice.organization_id)
        )
        for user in users_result.scalars().all():
            await create_notification(
                db,
                user_id=user.id,
                event_type=NotificationEventType.PAYMENT_CONFIRMED,
                title="Payment Confirmed",
                message=f"Payment received for invoice {invoice.invoice_number}",
                reference_id=invoice.id,
                reference_type=NotificationReferenceType.INVOICE,
            )

    return {"status": invoice.status.value}


@router.post("/invoices/bulk-status")
async def bulk_update_status(
    body: BulkStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    result = await billing_service.bulk_update_invoice_status(
        db, body.invoice_ids, body.status
    )

    for inv_id_str in result["updated"]:
        await log_activity(
            db,
            actor_id=current_user.id,
            actor_type="ADMIN",
            action="INVOICE_STATUS_UPDATED",
            target_type="INVOICE",
            target_id=UUID(inv_id_str),
            metadata={"new_status": body.status},
        )

    return result


@router.post("/generate")
async def generate_invoices(
    body: GenerateInvoicesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    invoices = await billing_service.generate_invoices_for_month(db, body.month)
    return {
        "count": len(invoices),
        "invoices": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "invoice_type": inv.invoice_type.value,
                "amount": str(inv.amount),
                "status": inv.status.value,
            }
            for inv in invoices
        ],
    }


@router.get("/export")
async def export_invoices(
    month: str = Query(...),
    invoice_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    type_enum = InvoiceType(invoice_type) if invoice_type else None
    invoices = await billing_service.get_invoices(db, month=month, invoice_type=type_enum)

    from sqlalchemy import select

    rows = []
    for inv in invoices:
        org = await db.execute(
            select(Organization.name).where(Organization.id == inv.organization_id)
        )
        org_name = org.scalar_one_or_none() or ""
        rows.append({
            "invoice_number": inv.invoice_number or "",
            "type": inv.invoice_type.value,
            "organization": org_name,
            "amount": str(inv.amount),
            "status": inv.status.value,
            "line_items": str(inv.line_items_count),
            "generated_at": inv.generated_at.isoformat() if inv.generated_at else "",
        })

    columns = [
        ("Invoice Number", "invoice_number"),
        ("Type", "type"),
        ("Organization", "organization"),
        ("Amount", "amount"),
        ("Status", "status"),
        ("Line Items", "line_items"),
        ("Generated At", "generated_at"),
    ]

    return generate_csv_response(rows, columns, f"invoices-{month}.csv")
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add the import and include:

```python
# Add import after line 24:
from app.api.admin.billing import router as admin_billing_router

# Add include after line 78:
app.include_router(admin_billing_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/admin/billing.py backend/app/main.py
git commit -m "feat(phase12a): add admin billing API endpoints"
```

---

### Task 6: Vendor and lender billing API endpoints

**Files:**
- Create: `backend/app/api/vendor/billing.py`
- Create: `backend/app/api/lender/billing.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create vendor billing router**

Create `backend/app/api/vendor/billing.py`:

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.billing import BillingEntriesWithInvoice
from app.services import billing_service
from app.services.csv_export_service import generate_csv_response

router = APIRouter(prefix="/api/vendor/billing", tags=["vendor-billing"])


@router.get("/entries", response_model=BillingEntriesWithInvoice)
async def get_vendor_entries(
    month: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    result = await billing_service.get_org_billing_entries(
        db,
        org_id=current_user.organization_id,
        month=month,
        entry_type="earning",
    )
    return result


@router.get("/export")
async def export_vendor_entries(
    month: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    result = await billing_service.get_org_billing_entries(
        db,
        org_id=current_user.organization_id,
        month=month,
        entry_type="earning",
    )
    columns = [
        ("Report ID", "report_id"),
        ("Request ID", "request_id"),
        ("Type", "entry_type"),
        ("Amount", "amount"),
        ("Date", "created_at"),
    ]
    return generate_csv_response(
        result["entries"], columns, f"vendor-earnings-{month}.csv"
    )
```

- [ ] **Step 2: Create lender billing router**

Create `backend/app/api/lender/billing.py`:

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.billing import BillingEntriesWithInvoice
from app.services import billing_service
from app.services.csv_export_service import generate_csv_response

router = APIRouter(prefix="/api/lender/billing", tags=["lender-billing"])


@router.get("/entries", response_model=BillingEntriesWithInvoice)
async def get_lender_entries(
    month: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    result = await billing_service.get_org_billing_entries(
        db,
        org_id=current_user.organization_id,
        month=month,
        entry_type="payable",
    )
    return result


@router.get("/export")
async def export_lender_entries(
    month: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    result = await billing_service.get_org_billing_entries(
        db,
        org_id=current_user.organization_id,
        month=month,
        entry_type="payable",
    )
    columns = [
        ("Report ID", "report_id"),
        ("Request ID", "request_id"),
        ("Type", "entry_type"),
        ("Amount", "amount"),
        ("Status", "status"),
        ("Date", "created_at"),
    ]
    return generate_csv_response(
        result["entries"], columns, f"lender-payables-{month}.csv"
    )
```

- [ ] **Step 3: Register both routers in main.py**

In `backend/app/main.py`, add imports and includes:

```python
# Add imports:
from app.api.vendor.billing import router as vendor_billing_router
from app.api.lender.billing import router as lender_billing_router

# Add includes:
app.include_router(vendor_billing_router)
app.include_router(lender_billing_router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/vendor/billing.py backend/app/api/lender/billing.py backend/app/main.py
git commit -m "feat(phase12a): add vendor and lender billing API endpoints"
```

---

### Task 7: Frontend billing types

**Files:**
- Create: `frontend/src/types/billing.ts`

- [ ] **Step 1: Create billing TypeScript types**

Create `frontend/src/types/billing.ts`:

```typescript
export interface InvoiceResponse {
  id: string;
  invoice_type: string;
  organization_id: string;
  amount: string;
  status: string;
  month: string;
  generated_at: string | null;
  invoice_number: string | null;
  line_items_count: number;
  notes: string | null;
  org_name: string;
}

export interface BillingEntry {
  id: string;
  report_id: string;
  request_id: string | null;
  amount: string;
  entry_type: string;
  created_at: string;
}

export interface InvoiceDetailResponse extends InvoiceResponse {
  entries: BillingEntry[];
}

export interface BillingEntriesWithInvoice {
  entries: BillingEntry[];
  invoice_number: string | null;
  invoice_status: string | null;
}

export interface GenerateInvoicesResponse {
  count: number;
  invoices: {
    id: string;
    invoice_number: string | null;
    invoice_type: string;
    amount: string;
    status: string;
  }[];
}

export interface BulkStatusResponse {
  updated: string[];
  skipped: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/billing.ts
git commit -m "feat(phase12a): add frontend billing TypeScript types"
```

---

### Task 8: Admin billing page

**Files:**
- Create: `frontend/src/app/admin/billing/page.tsx`
- Create: `frontend/src/app/admin/billing/_components/invoice-table.tsx`
- Modify: `frontend/src/app/admin/layout.tsx:17-24` and `47-52`

- [ ] **Step 1: Add Billing nav link to admin layout**

In `frontend/src/app/admin/layout.tsx`, add the Billing link in both desktop sidebar (after the Pricing link on line 23) and mobile sidebar (after the Pricing link on line 51):

Desktop sidebar — add after line 23:
```tsx
          <a href="/admin/billing" className="block px-2 py-3 rounded hover:bg-gray-100">Billing</a>
```

Mobile sidebar — add after line 51:
```tsx
              <a href="/admin/billing" className="block px-2 py-3 rounded hover:bg-gray-100">Billing</a>
```

- [ ] **Step 2: Create invoice table component**

Create `frontend/src/app/admin/billing/_components/invoice-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  InvoiceResponse,
  BillingEntry,
  BulkStatusResponse,
} from "@/types/billing";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  BILLED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
};

interface Props {
  invoices: InvoiceResponse[];
  onRefresh: () => void;
}

export function InvoiceTable({ invoices, onRefresh }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.id)));
    }
  };

  const expandRow = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setEntries([]);
      return;
    }
    setExpanded(id);
    setLoadingEntries(true);
    try {
      const detail = await api.get<{ entries: BillingEntry[] }>(
        `/api/admin/billing/invoices/${id}`
      );
      setEntries(detail.entries);
    } catch {
      setEntries([]);
    }
    setLoadingEntries(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/api/admin/billing/invoices/${id}/status`, { status });
      onRefresh();
    } catch {
      // silent
    }
  };

  const bulkUpdate = async (status: string) => {
    if (selected.size === 0) return;
    try {
      await api.post<BulkStatusResponse>("/api/admin/billing/invoices/bulk-status", {
        invoice_ids: Array.from(selected),
        status,
      });
      setSelected(new Set());
      onRefresh();
    } catch {
      // silent
    }
  };

  if (invoices.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No invoices for this period.</p>;
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded border">
          <span className="text-sm text-gray-600">{selected.size} selected</span>
          <button
            onClick={() => bulkUpdate("BILLED")}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Mark as Billed
          </button>
          <button
            onClick={() => bulkUpdate("PAID")}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Mark as Paid
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-2 px-2">
                <input
                  type="checkbox"
                  checked={selected.size === invoices.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="text-left py-2 px-2">Invoice #</th>
              <th className="text-left py-2 px-2">Organization</th>
              <th className="text-right py-2 px-2">Amount</th>
              <th className="text-center py-2 px-2">Items</th>
              <th className="text-center py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Generated</th>
              <th className="text-center py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <>
                <tr
                  key={inv.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => expandRow(inv.id)}
                >
                  <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                    />
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{inv.invoice_number || "—"}</td>
                  <td className="py-2 px-2">{inv.org_name}</td>
                  <td className="py-2 px-2 text-right font-medium">
                    ₹{parseFloat(inv.amount).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-center">{inv.line_items_count}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] || ""}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-xs text-gray-500">
                    {inv.generated_at ? new Date(inv.generated_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="text-xs border rounded px-1 py-0.5"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) updateStatus(inv.id, e.target.value);
                      }}
                    >
                      <option value="">Change...</option>
                      {inv.status === "PENDING" && <option value="BILLED">→ Billed</option>}
                      {inv.status === "BILLED" && <option value="PAID">→ Paid</option>}
                      {inv.status === "PAID" && <option value="BILLED">→ Billed</option>}
                    </select>
                  </td>
                </tr>
                {expanded === inv.id && (
                  <tr key={`${inv.id}-detail`}>
                    <td colSpan={8} className="bg-gray-50 px-6 py-3">
                      {loadingEntries ? (
                        <p className="text-sm text-gray-400">Loading entries...</p>
                      ) : entries.length === 0 ? (
                        <p className="text-sm text-gray-400">No entries found.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-1">Report ID</th>
                              <th className="text-left py-1">Type</th>
                              <th className="text-right py-1">Amount</th>
                              <th className="text-left py-1">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((entry) => (
                              <tr key={entry.id} className="border-b">
                                <td className="py-1 font-mono">{entry.report_id.slice(0, 8)}...</td>
                                <td className="py-1">{entry.entry_type.replace(/_/g, " ")}</td>
                                <td className="py-1 text-right">₹{parseFloat(entry.amount).toLocaleString()}</td>
                                <td className="py-1">{new Date(entry.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {invoices.map((inv) => (
          <div key={inv.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(inv.id)}
                  onChange={() => toggleSelect(inv.id)}
                />
                <span className="font-mono text-xs">{inv.invoice_number || "—"}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] || ""}`}>
                {inv.status}
              </span>
            </div>
            <p className="text-sm font-medium">{inv.org_name}</p>
            <div className="flex justify-between text-sm mt-1">
              <span>₹{parseFloat(inv.amount).toLocaleString()}</span>
              <span className="text-gray-500">{inv.line_items_count} items</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => expandRow(inv.id)}
                className="text-xs text-blue-600 underline"
              >
                {expanded === inv.id ? "Hide" : "Details"}
              </button>
              <select
                className="text-xs border rounded px-1 py-0.5"
                value=""
                onChange={(e) => {
                  if (e.target.value) updateStatus(inv.id, e.target.value);
                }}
              >
                <option value="">Change status...</option>
                {inv.status === "PENDING" && <option value="BILLED">→ Billed</option>}
                {inv.status === "BILLED" && <option value="PAID">→ Paid</option>}
                {inv.status === "PAID" && <option value="BILLED">→ Billed</option>}
              </select>
            </div>
            {expanded === inv.id && (
              <div className="mt-2 pt-2 border-t">
                {loadingEntries ? (
                  <p className="text-xs text-gray-400">Loading...</p>
                ) : entries.length === 0 ? (
                  <p className="text-xs text-gray-400">No entries.</p>
                ) : (
                  <div className="space-y-1">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex justify-between text-xs">
                        <span>{entry.entry_type.replace(/_/g, " ")}</span>
                        <span>₹{parseFloat(entry.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create admin billing page**

Create `frontend/src/app/admin/billing/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  InvoiceResponse,
  GenerateInvoicesResponse,
} from "@/types/billing";
import { InvoiceTable } from "./_components/invoice-table";

type TabKey = "PAYABLE" | "RECEIVABLE";

const TABS: { key: TabKey; label: string }[] = [
  { key: "PAYABLE", label: "Lender Payables" },
  { key: "RECEIVABLE", label: "Vendor Receivables" },
];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptions(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export default function AdminBillingPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [tab, setTab] = useState<TabKey>("PAYABLE");
  const [allInvoices, setAllInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<InvoiceResponse[]>(
        `/api/admin/billing/invoices?month=${month}`
      );
      setAllInvoices(data);
    } catch {
      setAllInvoices([]);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post<GenerateInvoicesResponse>("/api/admin/billing/generate", {
        month,
      });
      await fetchInvoices();
    } catch {
      // silent
    }
    setGenerating(false);
  };

  const handleExport = async () => {
    try {
      const blob = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/billing/export?month=${month}&invoice_type=${tab}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  };

  const tabInvoices = allInvoices.filter((i) => i.invoice_type === tab);

  const totalPayables = allInvoices
    .filter((i) => i.invoice_type === "PAYABLE")
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const totalReceivables = allInvoices
    .filter((i) => i.invoice_type === "RECEIVABLE")
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const pendingCount = allInvoices.filter((i) => i.status === "PENDING").length;
  const paidCount = allInvoices.filter((i) => i.status === "PAID").length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            {getMonthOptions().map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Invoices"}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500">Total Payables</p>
          <p className="text-xl font-bold">₹{totalPayables.toLocaleString()}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500">Total Receivables</p>
          <p className="text-xl font-bold">₹{totalReceivables.toLocaleString()}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500">Paid</p>
          <p className="text-xl font-bold text-green-600">{paidCount}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-gray-100 rounded" />
      ) : (
        <InvoiceTable invoices={tabInvoices} onRefresh={fetchInvoices} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/billing/ frontend/src/app/admin/layout.tsx
git commit -m "feat(phase12a): add admin billing page with invoice table"
```

---

### Task 9: Enhanced vendor receivables section

**Files:**
- Modify: `frontend/src/app/vendor/dashboard/_components/receivables-section.tsx:1-82`
- Modify: `frontend/src/types/dashboard.ts`

- [ ] **Step 1: Add invoice fields to MonthlyAmount type**

In `frontend/src/types/dashboard.ts`, extend the `MonthlyAmount` interface:

```typescript
export interface MonthlyAmount {
  month: string;
  total_amount: string;
  invoice_number?: string | null;
  invoice_status?: string | null;
}
```

- [ ] **Step 2: Rewrite receivables section with expandable rows and CSV**

Replace the contents of `frontend/src/app/vendor/dashboard/_components/receivables-section.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { VendorReceivablesResponse } from "@/types/dashboard";
import { BillingEntry } from "@/types/billing";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  BILLED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
};

interface Props {
  fyYear: number;
}

export function ReceivablesSection({ fyYear }: Props) {
  const [data, setData] = useState<VendorReceivablesResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    api
      .get<VendorReceivablesResponse>(
        `/api/vendor/dashboard/receivables?fy_year=${fyYear}`
      )
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

  const expandMonth = async (month: string) => {
    if (expanded === month) {
      setExpanded(null);
      setEntries([]);
      return;
    }
    setExpanded(month);
    setLoadingEntries(true);
    try {
      const result = await api.get<{ entries: BillingEntry[] }>(
        `/api/vendor/billing/entries?month=${month}`
      );
      setEntries(result.entries);
    } catch {
      setEntries([]);
    }
    setLoadingEntries(false);
  };

  const exportMonth = async (month: string) => {
    try {
      const blob = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/vendor/billing/export?month=${month}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendor-earnings-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  };

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
                    <td className="text-right py-2 font-medium">
                      ₹{parseFloat(row.total_amount).toLocaleString()}
                    </td>
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
                  <th className="text-center py-2">Invoice</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-center py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.month_wise.map((row) => (
                  <>
                    <tr
                      key={row.month}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => expandMonth(row.month)}
                    >
                      <td className="py-2">{row.month}</td>
                      <td className="text-right py-2 font-medium">
                        ₹{parseFloat(row.total_amount).toLocaleString()}
                      </td>
                      <td className="text-center py-2 font-mono text-xs">
                        {row.invoice_number || "—"}
                      </td>
                      <td className="text-center py-2">
                        {row.invoice_status ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.invoice_status] || "bg-gray-100 text-gray-500"}`}
                          >
                            {row.invoice_status}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Not Generated
                          </span>
                        )}
                      </td>
                      <td className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => exportMonth(row.month)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          CSV
                        </button>
                      </td>
                    </tr>
                    {expanded === row.month && (
                      <tr key={`${row.month}-detail`}>
                        <td colSpan={5} className="bg-gray-50 px-4 py-3">
                          {loadingEntries ? (
                            <p className="text-xs text-gray-400">Loading entries...</p>
                          ) : entries.length === 0 ? (
                            <p className="text-xs text-gray-400">No entries.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-1">Report ID</th>
                                  <th className="text-left py-1">Type</th>
                                  <th className="text-right py-1">Amount</th>
                                  <th className="text-left py-1">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entries.map((e) => (
                                  <tr key={e.id} className="border-b">
                                    <td className="py-1 font-mono">
                                      {e.report_id.slice(0, 8)}...
                                    </td>
                                    <td className="py-1">
                                      {e.entry_type.replace(/_/g, " ")}
                                    </td>
                                    <td className="py-1 text-right">
                                      ₹{parseFloat(e.amount).toLocaleString()}
                                    </td>
                                    <td className="py-1">
                                      {new Date(e.created_at).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
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

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/vendor/dashboard/_components/receivables-section.tsx frontend/src/types/dashboard.ts
git commit -m "feat(phase12a): enhance vendor receivables with invoice status, drill-down, and CSV"
```

---

### Task 10: Enhanced lender payables section

**Files:**
- Modify: `frontend/src/app/lender/dashboard/_components/payables-section.tsx:1-97`

- [ ] **Step 1: Rewrite payables section with expandable rows and CSV**

Replace the contents of `frontend/src/app/lender/dashboard/_components/payables-section.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { LenderPayablesResponse } from "@/types/dashboard";
import { BillingEntry } from "@/types/billing";

const PIE_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626"];

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  BILLED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
};

interface Props {
  fyYear: number;
}

export function PayablesSection({ fyYear }: Props) {
  const [data, setData] = useState<LenderPayablesResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    api
      .get<LenderPayablesResponse>(
        `/api/lender/dashboard/payables?fy_year=${fyYear}`
      )
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

  const expandMonth = async (month: string) => {
    if (expanded === month) {
      setExpanded(null);
      setEntries([]);
      return;
    }
    setExpanded(month);
    setLoadingEntries(true);
    try {
      const result = await api.get<{ entries: BillingEntry[] }>(
        `/api/lender/billing/entries?month=${month}`
      );
      setEntries(result.entries);
    } catch {
      setEntries([]);
    }
    setLoadingEntries(false);
  };

  const exportMonth = async (month: string) => {
    try {
      const blob = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/lender/billing/export?month=${month}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lender-payables-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  };

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
          <p className="text-2xl font-bold text-yellow-800">
            ₹{parseFloat(data.totals.pending).toLocaleString()}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Billed</p>
          <p className="text-2xl font-bold text-blue-800">
            ₹{parseFloat(data.totals.billed).toLocaleString()}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">Paid</p>
          <p className="text-2xl font-bold text-green-800">
            ₹{parseFloat(data.totals.paid).toLocaleString()}
          </p>
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
                    <th className="text-center py-2">Invoice</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-center py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.month_wise.map((row) => (
                    <>
                      <tr
                        key={row.month}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => expandMonth(row.month)}
                      >
                        <td className="py-2">{row.month}</td>
                        <td className="text-right py-2 font-medium">
                          ₹{parseFloat(row.total_amount).toLocaleString()}
                        </td>
                        <td className="text-center py-2 font-mono text-xs">
                          {row.invoice_number || "—"}
                        </td>
                        <td className="text-center py-2">
                          {row.invoice_status ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.invoice_status] || "bg-gray-100 text-gray-500"}`}
                            >
                              {row.invoice_status}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              Not Generated
                            </span>
                          )}
                        </td>
                        <td
                          className="text-center py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => exportMonth(row.month)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            CSV
                          </button>
                        </td>
                      </tr>
                      {expanded === row.month && (
                        <tr key={`${row.month}-detail`}>
                          <td colSpan={5} className="bg-gray-50 px-4 py-3">
                            {loadingEntries ? (
                              <p className="text-xs text-gray-400">Loading entries...</p>
                            ) : entries.length === 0 ? (
                              <p className="text-xs text-gray-400">No entries.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-1">Report ID</th>
                                    <th className="text-left py-1">Type</th>
                                    <th className="text-right py-1">Amount</th>
                                    <th className="text-left py-1">Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entries.map((e) => (
                                    <tr key={e.id} className="border-b">
                                      <td className="py-1 font-mono">
                                        {e.report_id.slice(0, 8)}...
                                      </td>
                                      <td className="py-1">
                                        {e.entry_type.replace(/_/g, " ")}
                                      </td>
                                      <td className="py-1 text-right">
                                        ₹{parseFloat(e.amount).toLocaleString()}
                                      </td>
                                      <td className="py-1">
                                        {new Date(e.created_at).toLocaleDateString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
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
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => `₹${v.toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/lender/dashboard/_components/payables-section.tsx
git commit -m "feat(phase12a): enhance lender payables with invoice status, drill-down, and CSV"
```

---

### Task 11: Backend — add invoice data to dashboard responses

**Files:**
- Modify: `backend/app/services/dashboard_service.py`

- [ ] **Step 1: Add invoice status to month-wise receivables response**

In `backend/app/services/dashboard_service.py`, update the `get_vendor_receivables` function to include invoice data in the month_wise results. After the existing month_wise query, add a lookup for invoice status per month:

```python
# After the month_wise list is built, enrich with invoice data:
from app.models.billing import Invoice
from app.models.enums import InvoiceType

# Get vendor's org_id from vendor_id
from app.models.vendor import Vendor as VendorModel
vendor_result = await db.execute(
    select(VendorModel.organization_id).where(VendorModel.id == vendor_id)
)
vendor_org_id = vendor_result.scalar_one_or_none()

if vendor_org_id:
    for item in month_wise:
        inv_result = await db.execute(
            select(Invoice).where(
                Invoice.organization_id == vendor_org_id,
                Invoice.month == item["month"],
                Invoice.invoice_type == InvoiceType.RECEIVABLE,
            )
        )
        inv = inv_result.scalar_one_or_none()
        item["invoice_number"] = inv.invoice_number if inv else None
        item["invoice_status"] = inv.status.value if inv else None
```

- [ ] **Step 2: Add invoice status to month-wise payables response**

Similarly, update `get_lender_payables_summary` to include invoice data in the month_wise results:

```python
# After the month_wise list is built, enrich with invoice data:
from app.models.billing import Invoice
from app.models.enums import InvoiceType
from app.models.lender import Lender as LenderModel

lender_result = await db.execute(
    select(LenderModel.organization_id).where(LenderModel.id == lender_id)
)
lender_org_id = lender_result.scalar_one_or_none()

if lender_org_id:
    for item in month_wise:
        inv_result = await db.execute(
            select(Invoice).where(
                Invoice.organization_id == lender_org_id,
                Invoice.month == item["month"],
                Invoice.invoice_type == InvoiceType.PAYABLE,
            )
        )
        inv = inv_result.scalar_one_or_none()
        item["invoice_number"] = inv.invoice_number if inv else None
        item["invoice_status"] = inv.status.value if inv else None
```

- [ ] **Step 3: Update dashboard Pydantic schemas**

In `backend/app/schemas/dashboard.py`, update `MonthlyAmount` to include the optional invoice fields:

```python
class MonthlyAmount(BaseModel):
    month: str
    total_amount: str
    invoice_number: str | None = None
    invoice_status: str | None = None
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/dashboard_service.py backend/app/schemas/dashboard.py
git commit -m "feat(phase12a): add invoice data to dashboard month-wise responses"
```

---

### Task 12: Update CLAUDE.md with Phase 12A status

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Phase 12A to Current Status section**

Add after the Phase 11 entry in CLAUDE.md:

```
**Phase 12A (Billing & Invoicing):** Complete — Monthly invoice generation Celery job (1st of month), structured invoice numbering (GTR-PAY/RCV-YYYY-MM-NNNN), invoice lifecycle management (PENDING → BILLED → PAID), dedicated admin billing page with bulk status updates and CSV export, enhanced vendor receivables with invoice status drill-down and CSV, enhanced lender payables with invoice status drill-down and CSV, notifications on invoice generation and payment confirmation, activity logging for billing events
```

- [ ] **Step 2: Add new key files**

Add to the Key Files section in CLAUDE.md:

```
- `backend/app/api/admin/billing.py` — Admin billing API (6 endpoints)
- `backend/app/api/vendor/billing.py` — Vendor billing entries + CSV export
- `backend/app/api/lender/billing.py` — Lender billing entries + CSV export
- `backend/app/jobs/billing_tasks.py` — Monthly invoice generation Celery task
- `frontend/src/app/admin/billing/page.tsx` — Admin billing page
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(phase12a): update CLAUDE.md with Phase 12A completion status"
```

---

### Task 13: Verify — backend starts and frontend type-checks

**Files:** None (verification only)

- [ ] **Step 1: Verify backend starts**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.main import app; print('Backend imports OK')"
```

Expected: `Backend imports OK`

- [ ] **Step 2: Run frontend type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Fix any issues found**

If there are TypeScript errors or backend import failures, fix them and create a fix commit:

```bash
git add -A
git commit -m "fix(phase12a): fix TypeScript/import errors"
```
