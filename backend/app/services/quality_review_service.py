from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import QualityReviewStatus, ReportStatus
from app.models.quality_review import QualityReview
from app.models.report import Report


async def create_review_for_report(db: AsyncSession, report_id: UUID) -> QualityReview:
    review = QualityReview(
        report_id=report_id,
        status=QualityReviewStatus.PENDING,
    )
    db.add(review)
    await db.flush()
    return review


async def get_review_queue(
    db: AsyncSession,
    *,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    base_query = (
        select(QualityReview, Report)
        .join(Report, Report.id == QualityReview.report_id)
    )

    if status:
        base_query = base_query.where(
            QualityReview.status == QualityReviewStatus(status)
        )
    else:
        base_query = base_query.where(
            QualityReview.status == QualityReviewStatus.PENDING
        )

    count_q = select(func.count()).select_from(
        base_query.subquery()
    )
    count_result = await db.execute(count_q)
    total = count_result.scalar() or 0

    result = await db.execute(
        base_query
        .order_by(QualityReview.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = result.all()

    items = []
    for row in rows:
        review = row.QualityReview
        report = row.Report
        items.append({
            "id": str(review.id),
            "report_id": str(review.report_id),
            "status": review.status.value,
            "feedback_text": review.feedback_text,
            "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
            "reviewer_user_id": str(review.reviewer_user_id) if review.reviewer_user_id else None,
            "created_at": review.created_at.isoformat(),
            "report": {
                "id": str(report.id),
                "filename": report.filename if hasattr(report, 'filename') else None,
                "status": report.status.value if report.status else None,
                "property_type": report.property_type if hasattr(report, 'property_type') else None,
                "city": report.city if hasattr(report, 'city') else None,
                "created_at": report.created_at.isoformat(),
            },
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_review_detail(db: AsyncSession, review_id: UUID) -> dict | None:
    result = await db.execute(
        select(QualityReview, Report)
        .join(Report, Report.id == QualityReview.report_id)
        .where(QualityReview.id == review_id)
    )
    row = result.first()
    if not row:
        return None

    review = row.QualityReview
    report = row.Report

    return {
        "id": str(review.id),
        "report_id": str(review.report_id),
        "status": review.status.value,
        "feedback_text": review.feedback_text,
        "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
        "reviewer_user_id": str(review.reviewer_user_id) if review.reviewer_user_id else None,
        "created_at": review.created_at.isoformat(),
        "report": {
            "id": str(report.id),
            "filename": report.filename if hasattr(report, 'filename') else None,
            "status": report.status.value if report.status else None,
            "property_type": report.property_type if hasattr(report, 'property_type') else None,
            "city": report.city if hasattr(report, 'city') else None,
            "content_json": report.content_json if hasattr(report, 'content_json') else None,
            "created_at": report.created_at.isoformat(),
        },
    }


async def submit_review_decision(
    db: AsyncSession,
    review_id: UUID,
    *,
    reviewer_user_id: UUID,
    decision: str,
    feedback_text: str | None = None,
) -> QualityReview:
    result = await db.execute(
        select(QualityReview).where(QualityReview.id == review_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise ValueError("Review not found")

    if review.status != QualityReviewStatus.PENDING:
        raise ValueError("Review has already been processed")

    review.status = QualityReviewStatus(decision)
    review.reviewer_user_id = reviewer_user_id
    review.feedback_text = feedback_text
    review.reviewed_at = datetime.now(timezone.utc)

    # Update report status based on decision
    report_result = await db.execute(
        select(Report).where(Report.id == review.report_id)
    )
    report = report_result.scalar_one_or_none()

    if report:
        if decision == "APPROVED":
            report.status = ReportStatus.PUBLISHED
        elif decision == "RETURNED":
            report.status = ReportStatus.READY_TO_PUBLISH

    await db.flush()
    return review
