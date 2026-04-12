from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lender import Lender
from app.models.user import Organization
from app.models.vendor_config import VendorConfig, VendorLenderExclusion


async def get_vendor_config(db: AsyncSession, vendor_id: UUID) -> VendorConfig:
    result = await db.execute(
        select(VendorConfig).where(VendorConfig.vendor_id == vendor_id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = VendorConfig(vendor_id=vendor_id)
        db.add(config)
        await db.flush()
    return config


async def update_vendor_config(
    db: AsyncSession, vendor_id: UUID, *, updates: dict
) -> VendorConfig:
    config = await get_vendor_config(db, vendor_id)
    for key, value in updates.items():
        if value is not None and hasattr(config, key):
            if key == "price_threshold" and value is not None:
                setattr(config, key, Decimal(value))
            else:
                setattr(config, key, value)
    await db.flush()
    return config


async def get_vendor_exclusions(
    db: AsyncSession, vendor_id: UUID
) -> list[dict]:
    result = await db.execute(
        select(VendorLenderExclusion, Organization.name)
        .join(Lender, Lender.id == VendorLenderExclusion.lender_id)
        .join(Organization, Organization.id == Lender.organization_id)
        .where(VendorLenderExclusion.vendor_id == vendor_id)
        .order_by(VendorLenderExclusion.created_at.desc())
    )
    return [
        {
            "lender_id": str(row.VendorLenderExclusion.lender_id),
            "lender_name": row.name,
            "created_at": row.VendorLenderExclusion.created_at.isoformat(),
        }
        for row in result.all()
    ]


async def add_vendor_exclusion(
    db: AsyncSession, vendor_id: UUID, lender_id: UUID
) -> VendorLenderExclusion:
    result = await db.execute(
        select(VendorLenderExclusion).where(
            VendorLenderExclusion.vendor_id == vendor_id,
            VendorLenderExclusion.lender_id == lender_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError("Exclusion already exists")

    exclusion = VendorLenderExclusion(
        vendor_id=vendor_id, lender_id=lender_id
    )
    db.add(exclusion)
    await db.flush()
    return exclusion


async def remove_vendor_exclusion(
    db: AsyncSession, vendor_id: UUID, lender_id: UUID
) -> None:
    result = await db.execute(
        select(VendorLenderExclusion).where(
            VendorLenderExclusion.vendor_id == vendor_id,
            VendorLenderExclusion.lender_id == lender_id,
        )
    )
    exclusion = result.scalar_one_or_none()
    if exclusion:
        await db.delete(exclusion)
        await db.flush()


async def get_excluded_vendor_ids_for_lender(
    db: AsyncSession, lender_id: UUID
) -> list[UUID]:
    result = await db.execute(
        select(VendorLenderExclusion.vendor_id).where(
            VendorLenderExclusion.lender_id == lender_id
        )
    )
    return list(result.scalars().all())
