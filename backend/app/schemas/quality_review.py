from pydantic import BaseModel


class QualityReviewDecision(BaseModel):
    decision: str  # APPROVED, RETURNED, FLAGGED
    feedback_text: str | None = None
