from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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


async def create_billing_entries(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
    payable_type: PayableType | None = None,
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

    resolved_payable_type = payable_type or PayableType.NEW_REQUEST
    payable = LenderPayable(
        lender_id=request.lender_id,
        report_id=report.id,
        request_id=request.id,
        amount=request.price,
        payable_type=resolved_payable_type,
        status=PaymentStatus.PENDING,
        month=month,
    )
    db.add(payable)

    await db.flush()
    return earning, payable


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

    # Vendor receivable invoices
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
        vendor_result = await db.execute(
            select(Organization.id).join(
                Vendor, Organization.id == Vendor.organization_id
            ).where(Vendor.id == row.vendor_id)
        )
        org_id = vendor_result.scalar_one_or_none()
        if not org_id:
            continue

        inv_number = await generate_invoice_number(db, InvoiceType.RECEIVABLE, month)
        invoice = Invoice(
            invoice_type=InvoiceType.RECEIVABLE,
            organization_id=org_id,
            amount=row.total,
            status=PaymentStatus.PENDING,
            month=month,
            generated_at=datetime.utcnow(),
            invoice_number=inv_number,
            line_items_count=row.cnt,
        )
        db.add(invoice)
        invoices.append(invoice)

    # Lender payable invoices
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
        lender_result = await db.execute(
            select(Organization.id).join(
                Lender, Organization.id == Lender.organization_id
            ).where(Lender.id == row.lender_id)
        )
        org_id = lender_result.scalar_one_or_none()
        if not org_id:
            continue

        inv_number = await generate_invoice_number(db, InvoiceType.PAYABLE, month)
        invoice = Invoice(
            invoice_type=InvoiceType.PAYABLE,
            organization_id=org_id,
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
            select(Vendor.id).join(
                Organization, Vendor.organization_id == Organization.id
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
        lender_result = await db.execute(
            select(Lender.id).join(
                Organization, Lender.organization_id == Organization.id
            ).where(Organization.id == invoice.organization_id)
        )
        lender_id = lender_result.scalar_one_or_none()
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
            select(Vendor.id).join(
                Organization, Vendor.organization_id == Organization.id
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
            select(Lender.id).join(
                Organization, Lender.organization_id == Organization.id
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
