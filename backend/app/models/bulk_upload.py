import uuid

from sqlalchemy import Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import BulkUploadStatus


class BulkUploadJob(BaseModel):
    __tablename__ = "bulk_upload_jobs"

    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    total_reports: Mapped[int] = mapped_column(Integer, default=0)
    processed_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[BulkUploadStatus] = mapped_column(
        SQLEnum(BulkUploadStatus), default=BulkUploadStatus.PENDING
    )
