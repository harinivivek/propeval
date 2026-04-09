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
