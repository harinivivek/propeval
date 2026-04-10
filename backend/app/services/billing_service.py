from datetime import datetime
from decimal import Decimal
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
