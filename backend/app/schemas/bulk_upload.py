from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BulkUploadJobResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    total_reports: int
    processed_count: int
    failed_count: int
    status: str
    created_at: datetime
    updated_at: datetime


class BulkUploadReportStatus(BaseModel):
    """Per-report status within a bulk job."""
    report_id: UUID
    status: str
    property_address: str | None = None
