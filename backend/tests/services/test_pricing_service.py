from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PropertyType, ReportCategory, RequestType, UserType
from app.models.lender import Lender
from app.models.user import Organization


async def _create_test_lender(db: AsyncSession) -> Lender:
    """Helper to create a lender for pricing tests."""
    org = Organization(name="Test Lender Org", type=UserType.LENDER, city="Mumbai")
    db.add(org)
    await db.flush()
    lender = Lender(organization_id=org.id, name="Test Lender", city="Mumbai")
    db.add(lender)
    await db.flush()
    return lender


@pytest.mark.asyncio
async def test_create_pricing_rule(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule

    lender = await _create_test_lender(db_session)
    rule = await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    assert rule.id is not None
    assert rule.lender_id == lender.id
    assert rule.new_request_price == Decimal("2500.00")
    assert rule.is_active is True


@pytest.mark.asyncio
async def test_list_pricing_rules(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, list_pricing_rules

    lender = await _create_test_lender(db_session)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    rules = await list_pricing_rules(db_session, lender_id=lender.id)
    assert len(rules) == 1
    assert rules[0].city == "Mumbai"


@pytest.mark.asyncio
async def test_get_price_exact_match(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, get_price

    lender = await _create_test_lender(db_session)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        new_request_price=Decimal("3000.00"),
        listing_download_price=Decimal("2000.00"),
        update_additional_price=Decimal("1500.00"),
        nearby_additional_price=Decimal("1500.00"),
    )
    result = await get_price(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area="Andheri",
        property_type="RESIDENTIAL",
        request_type="NEW",
    )
    assert result.amount == Decimal("3000.00")
    assert result.matched_area == "Andheri"


@pytest.mark.asyncio
async def test_get_price_fallback_to_city(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, get_price

    lender = await _create_test_lender(db_session)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    result = await get_price(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area="Bandra",
        property_type="RESIDENTIAL",
        request_type="NEW",
    )
    assert result.amount == Decimal("2500.00")
    assert result.matched_area is None


@pytest.mark.asyncio
async def test_get_price_not_found(db_session: AsyncSession):
    from app.services.pricing_service import get_price, PricingNotFoundError

    lender = await _create_test_lender(db_session)
    with pytest.raises(PricingNotFoundError):
        await get_price(
            db_session,
            lender_id=lender.id,
            report_category="VALUATION",
            city="Delhi",
            area=None,
            property_type="RESIDENTIAL",
            request_type="NEW",
        )


@pytest.mark.asyncio
async def test_get_price_returns_correct_variant(db_session: AsyncSession):
    from app.services.pricing_service import create_pricing_rule, get_price

    lender = await _create_test_lender(db_session)
    await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="LEGAL",
        city="Mumbai",
        area=None,
        property_type="COMMERCIAL",
        new_request_price=Decimal("5000.00"),
        listing_download_price=Decimal("3000.00"),
        update_additional_price=Decimal("2000.00"),
        nearby_additional_price=Decimal("1500.00"),
    )
    new = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "NEW")
    assert new.amount == Decimal("5000.00")

    download = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "LISTING_DOWNLOAD")
    assert download.amount == Decimal("3000.00")

    update = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "UPDATE")
    assert update.amount == Decimal("2000.00")

    nearby = await get_price(db_session, lender.id, "LEGAL", "Mumbai", None, "COMMERCIAL", "NEARBY")
    assert nearby.amount == Decimal("1500.00")


@pytest.mark.asyncio
async def test_delete_pricing_rule_soft_deletes(db_session: AsyncSession):
    from app.services.pricing_service import (
        create_pricing_rule,
        delete_pricing_rule,
        list_pricing_rules,
    )

    lender = await _create_test_lender(db_session)
    rule = await create_pricing_rule(
        db_session,
        lender_id=lender.id,
        report_category="VALUATION",
        city="Mumbai",
        area=None,
        property_type="RESIDENTIAL",
        new_request_price=Decimal("2500.00"),
        listing_download_price=Decimal("1500.00"),
        update_additional_price=Decimal("1000.00"),
        nearby_additional_price=Decimal("1000.00"),
    )
    await delete_pricing_rule(db_session, rule.id)
    rules = await list_pricing_rules(db_session, lender_id=lender.id)
    assert len(rules) == 0
