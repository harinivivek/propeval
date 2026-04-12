from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.schemas.pricing import (
    PriceCalculationResponse,
    PricingRuleCreate,
    PricingRuleResponse,
    PricingRuleUpdate,
)
from app.services import pricing_service
from app.services.pricing_service import PricingNotFoundError

router = APIRouter(prefix="/api/admin/pricing", tags=["admin-pricing"])


@router.get("/rules", response_model=list[PricingRuleResponse])
async def list_rules(
    lender_id: UUID = Query(...),
    city: str | None = Query(None),
    report_category: str | None = Query(None),
    property_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    all_results = await pricing_service.list_pricing_rules(
        db,
        lender_id=lender_id,
        city=city,
        report_category=report_category,
        property_type=property_type,
    )
    start = (page - 1) * page_size
    return all_results[start : start + page_size]


@router.post(
    "/rules",
    response_model=PricingRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    payload: PricingRuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await pricing_service.create_pricing_rule(
        db,
        lender_id=payload.lender_id,
        report_category=payload.report_category,
        city=payload.city,
        area=payload.area,
        property_type=payload.property_type,
        new_request_price=payload.new_request_price,
        listing_download_price=payload.listing_download_price,
        update_additional_price=payload.update_additional_price,
        nearby_additional_price=payload.nearby_additional_price,
    )


@router.put("/rules/{rule_id}", response_model=PricingRuleResponse)
async def update_rule(
    rule_id: UUID,
    payload: PricingRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    rule = await pricing_service.get_pricing_rule(db, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found"
        )
    return await pricing_service.update_pricing_rule(
        db, rule, **payload.model_dump(exclude_unset=True)
    )


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    rule = await pricing_service.get_pricing_rule(db, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found"
        )
    await pricing_service.delete_pricing_rule(db, rule_id)
    return {"detail": "Pricing rule deleted"}


@router.get("/calculate", response_model=PriceCalculationResponse)
async def calculate_price(
    lender_id: UUID = Query(...),
    report_category: str = Query(...),
    city: str = Query(...),
    area: str | None = Query(None),
    property_type: str = Query(...),
    request_type: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    try:
        result = await pricing_service.get_price(
            db,
            lender_id=lender_id,
            report_category=report_category,
            city=city,
            area=area,
            property_type=property_type,
            request_type=request_type,
        )
    except PricingNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )
    return PriceCalculationResponse(
        amount=result.amount,
        rule_id=result.rule_id,
        matched_area=result.matched_area,
    )
