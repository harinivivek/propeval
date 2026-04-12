from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
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
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
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
    start = (page - 1) * page_size
    return results[start : start + page_size]


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
