from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PropertyType, ReportCategory
from app.models.pricing import PricingRule


class PricingNotFoundError(Exception):
    pass


@dataclass
class PriceResult:
    amount: Decimal
    rule_id: UUID
    matched_area: str | None


async def create_pricing_rule(
    db: AsyncSession,
    *,
    lender_id: UUID,
    report_category: str,
    city: str,
    area: str | None,
    property_type: str,
    new_request_price: Decimal,
    listing_download_price: Decimal,
    update_additional_price: Decimal,
    nearby_additional_price: Decimal,
) -> PricingRule:
    rule = PricingRule(
        lender_id=lender_id,
        report_category=ReportCategory(report_category),
        city=city,
        area=area,
        property_type=PropertyType(property_type),
        new_request_price=new_request_price,
        listing_download_price=listing_download_price,
        update_additional_price=update_additional_price,
        nearby_additional_price=nearby_additional_price,
    )
    db.add(rule)
    await db.flush()
    return rule


async def list_pricing_rules(
    db: AsyncSession,
    *,
    lender_id: UUID,
    city: str | None = None,
    report_category: str | None = None,
    property_type: str | None = None,
) -> list[PricingRule]:
    stmt = select(PricingRule).where(
        PricingRule.lender_id == lender_id,
        PricingRule.is_active == True,
    )
    if city:
        stmt = stmt.where(PricingRule.city == city)
    if report_category:
        stmt = stmt.where(PricingRule.report_category == ReportCategory(report_category))
    if property_type:
        stmt = stmt.where(PricingRule.property_type == PropertyType(property_type))
    stmt = stmt.order_by(PricingRule.city, PricingRule.area, PricingRule.property_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_pricing_rule(db: AsyncSession, rule_id: UUID) -> PricingRule | None:
    result = await db.execute(
        select(PricingRule).where(PricingRule.id == rule_id, PricingRule.is_active == True)
    )
    return result.scalar_one_or_none()


async def update_pricing_rule(
    db: AsyncSession, rule: PricingRule, **kwargs
) -> PricingRule:
    for key, value in kwargs.items():
        if value is not None and hasattr(rule, key):
            if key == "report_category":
                value = ReportCategory(value)
            elif key == "property_type":
                value = PropertyType(value)
            setattr(rule, key, value)
    await db.flush()
    return rule


async def delete_pricing_rule(db: AsyncSession, rule_id: UUID) -> None:
    rule = await get_pricing_rule(db, rule_id)
    if rule:
        rule.is_active = False
        await db.flush()


_VARIANT_MAP = {
    "NEW": "new_request_price",
    "LISTING_DOWNLOAD": "listing_download_price",
    "UPDATE": "update_additional_price",
    "NEARBY": "nearby_additional_price",
}


async def get_price(
    db: AsyncSession,
    lender_id: UUID,
    report_category: str,
    city: str,
    area: str | None,
    property_type: str,
    request_type: str,
) -> PriceResult:
    price_column = _VARIANT_MAP.get(request_type)
    if not price_column:
        raise ValueError(f"Unknown request_type: {request_type}")

    cat = ReportCategory(report_category)
    pt = PropertyType(property_type)

    # Try exact match (with area) first
    if area is not None:
        result = await db.execute(
            select(PricingRule).where(
                PricingRule.lender_id == lender_id,
                PricingRule.report_category == cat,
                PricingRule.city == city,
                PricingRule.area == area,
                PricingRule.property_type == pt,
                PricingRule.is_active == True,
            )
        )
        rule = result.scalar_one_or_none()
        if rule:
            return PriceResult(
                amount=getattr(rule, price_column),
                rule_id=rule.id,
                matched_area=rule.area,
            )

    # Fallback: city-level rule (area IS NULL)
    result = await db.execute(
        select(PricingRule).where(
            PricingRule.lender_id == lender_id,
            PricingRule.report_category == cat,
            PricingRule.city == city,
            PricingRule.area.is_(None),
            PricingRule.property_type == pt,
            PricingRule.is_active == True,
        )
    )
    rule = result.scalar_one_or_none()
    if rule:
        return PriceResult(
            amount=getattr(rule, price_column),
            rule_id=rule.id,
            matched_area=None,
        )

    raise PricingNotFoundError(
        f"No pricing rule found for lender={lender_id}, "
        f"category={report_category}, city={city}, area={area}, "
        f"property_type={property_type}"
    )
