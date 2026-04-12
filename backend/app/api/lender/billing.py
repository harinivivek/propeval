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
        ("Date", "created_at"),
    ]
    return generate_csv_response(
        result["entries"], columns, f"lender-payables-{month}.csv"
    )
