from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PropertyType, ReportCategory, VendorTier
from app.models.price_band import PriceBand, VendorPricing
from app.models.vendor_profile import VendorProfile


# --- Price Bands (Admin) ---


async def list_price_bands(db: AsyncSession) -> list[PriceBand]:
    result = await db.execute(
        select(PriceBand).order_by(PriceBand.city, PriceBand.property_type)
    )
    return list(result.scalars().all())


async def create_or_update_price_band(
    db: AsyncSession, *, city: str, property_type: str, report_category: str,
    min_price: str, max_price: str,
) -> PriceBand:
    result = await db.execute(
        select(PriceBand).where(
            PriceBand.city == city,
            PriceBand.property_type == PropertyType(property_type),
            PriceBand.report_category == ReportCategory(report_category),
        )
    )
    band = result.scalar_one_or_none()

    if band:
        band.min_price = Decimal(min_price)
        band.max_price = Decimal(max_price)
    else:
        band = PriceBand(
            city=city,
            property_type=PropertyType(property_type),
            report_category=ReportCategory(report_category),
            min_price=Decimal(min_price),
            max_price=Decimal(max_price),
        )
        db.add(band)

    await db.flush()
    return band


async def delete_price_band(db: AsyncSession, band_id: UUID) -> None:
    result = await db.execute(select(PriceBand).where(PriceBand.id == band_id))
    band = result.scalar_one_or_none()
    if band:
        await db.delete(band)
        await db.flush()


# --- Vendor Pricing ---


async def get_vendor_pricing(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    result = await db.execute(
        select(VendorPricing).where(VendorPricing.vendor_id == vendor_id)
        .order_by(VendorPricing.city, VendorPricing.property_type)
    )
    pricing_list = result.scalars().all()

    items = []
    for p in pricing_list:
        # Get corresponding band
        band_result = await db.execute(
            select(PriceBand).where(
                PriceBand.city == p.city,
                PriceBand.property_type == p.property_type,
                PriceBand.report_category == p.report_category,
            )
        )
        band = band_result.scalar_one_or_none()

        items.append({
            "id": str(p.id),
            "city": p.city,
            "property_type": p.property_type.value if p.property_type else "",
            "report_category": p.report_category.value if p.report_category else "",
            "price": str(p.price),
            "min_price": str(band.min_price) if band else None,
            "max_price": str(band.max_price) if band else None,
        })

    return items


async def upsert_vendor_pricing(
    db: AsyncSession, vendor_id: UUID, *, items: list[dict]
) -> list[VendorPricing]:
    # Check vendor tier - NEW tier cannot self-price
    profile_result = await db.execute(
        select(VendorProfile).where(VendorProfile.vendor_id == vendor_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile and profile.vendor_tier == VendorTier.NEW:
        raise ValueError("New-tier vendors cannot set their own pricing")

    results = []
    for item in items:
        city = item["city"]
        pt = PropertyType(item["property_type"])
        rc = ReportCategory(item["report_category"])
        price = Decimal(item["price"])

        # Validate against price band
        band_result = await db.execute(
            select(PriceBand).where(
                PriceBand.city == city,
                PriceBand.property_type == pt,
                PriceBand.report_category == rc,
            )
        )
        band = band_result.scalar_one_or_none()
        if band:
            if price < band.min_price or price > band.max_price:
                raise ValueError(
                    f"Price {price} for {city}/{pt.value}/{rc.value} must be "
                    f"between {band.min_price} and {band.max_price}"
                )

        # Upsert
        existing_result = await db.execute(
            select(VendorPricing).where(
                VendorPricing.vendor_id == vendor_id,
                VendorPricing.city == city,
                VendorPricing.property_type == pt,
                VendorPricing.report_category == rc,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.price = price
            results.append(existing)
        else:
            vp = VendorPricing(
                vendor_id=vendor_id,
                city=city,
                property_type=pt,
                report_category=rc,
                price=price,
            )
            db.add(vp)
            results.append(vp)

    await db.flush()
    return results


# --- Platform Fee ---


async def get_platform_fee(db: AsyncSession, fee_type: str = "platform_fee_new_request") -> Decimal:
    from app.services.system_config_service import get_config_value
    value = await get_config_value(db, fee_type)
    if value:
        return Decimal(str(value))
    return Decimal("300.00")  # default
