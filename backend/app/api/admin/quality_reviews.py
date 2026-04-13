from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.schemas.quality_review import QualityReviewDecision
from app.services import quality_review_service

router = APIRouter(prefix="/api/admin/quality-reviews", tags=["admin-quality-reviews"])


@router.get("")
async def list_quality_reviews(
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await quality_review_service.get_review_queue(
        db, status=status, page=page, page_size=page_size
    )


@router.get("/{review_id}")
async def get_quality_review(
    review_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    detail = await quality_review_service.get_review_detail(db, review_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Review not found")
    return detail


@router.put("/{review_id}")
async def submit_review_decision(
    review_id: UUID,
    body: QualityReviewDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    valid_decisions = {"APPROVED", "RETURNED", "FLAGGED"}
    if body.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Must be one of: {valid_decisions}")

    if body.decision in ("RETURNED", "FLAGGED") and not body.feedback_text:
        raise HTTPException(status_code=400, detail="Feedback is required for RETURNED and FLAGGED decisions")

    try:
        review = await quality_review_service.submit_review_decision(
            db, review_id,
            reviewer_user_id=current_user.id,
            decision=body.decision,
            feedback_text=body.feedback_text,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"detail": f"Review {body.decision.lower()}", "id": str(review.id)}
