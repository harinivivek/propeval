import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import QualityReviewStatus


class QualityReview(BaseModel):
    __tablename__ = "quality_reviews"

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id"), index=True
    )
    reviewer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    status: Mapped[QualityReviewStatus] = mapped_column(
        SQLEnum(QualityReviewStatus), default=QualityReviewStatus.PENDING
    )
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
