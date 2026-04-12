from uuid import UUID

from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lender_config import LenderConfig, LenderVendorPreference
from app.models.request import ReportRequest, RequestAcceptance
from app.models.user import Organization
from app.models.vendor import Vendor


async def get_lender_config(db: AsyncSession, lender_id: UUID) -> LenderConfig:
    result = await db.execute(
        select(LenderConfig).where(LenderConfig.lender_id == lender_id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = LenderConfig(lender_id=lender_id)
        db.add(config)
        await db.flush()
    return config


async def get_vendor_preferences(
    db: AsyncSession, lender_id: UUID
) -> list[dict]:
    """Get all vendors this lender has worked with + their auto-approve setting."""
    vendor_ids_stmt = (
        select(distinct(RequestAcceptance.vendor_id))
        .join(ReportRequest, ReportRequest.id == RequestAcceptance.request_id)
        .where(ReportRequest.lender_id == lender_id)
    )
    vendor_ids_result = await db.execute(vendor_ids_stmt)
    vendor_ids = list(vendor_ids_result.scalars().all())

    if not vendor_ids:
        return []

    vendors_result = await db.execute(
        select(Vendor.id, Organization.name)
        .join(Organization, Organization.id == Vendor.organization_id)
        .where(Vendor.id.in_(vendor_ids))
        .order_by(Organization.name)
    )
    vendors = vendors_result.all()

    prefs_result = await db.execute(
        select(LenderVendorPreference).where(
            LenderVendorPreference.lender_id == lender_id,
            LenderVendorPreference.vendor_id.in_(vendor_ids),
        )
    )
    prefs_map = {
        p.vendor_id: p.auto_approve
        for p in prefs_result.scalars().all()
    }

    return [
        {
            "vendor_id": str(row.id),
            "vendor_name": row.name,
            "auto_approve": prefs_map.get(row.id, False),
        }
        for row in vendors
    ]


async def set_vendor_preference(
    db: AsyncSession,
    lender_id: UUID,
    vendor_id: UUID,
    auto_approve: bool,
) -> LenderVendorPreference:
    result = await db.execute(
        select(LenderVendorPreference).where(
            LenderVendorPreference.lender_id == lender_id,
            LenderVendorPreference.vendor_id == vendor_id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.auto_approve = auto_approve
    else:
        pref = LenderVendorPreference(
            lender_id=lender_id,
            vendor_id=vendor_id,
            auto_approve=auto_approve,
        )
        db.add(pref)
    await db.flush()
    return pref


async def is_auto_approve(
    db: AsyncSession, lender_id: UUID, vendor_id: UUID
) -> bool:
    result = await db.execute(
        select(LenderVendorPreference.auto_approve).where(
            LenderVendorPreference.lender_id == lender_id,
            LenderVendorPreference.vendor_id == vendor_id,
        )
    )
    value = result.scalar_one_or_none()
    return value is True
