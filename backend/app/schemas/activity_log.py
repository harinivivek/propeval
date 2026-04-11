from pydantic import BaseModel


class ActivityLogResponse(BaseModel):
    id: str
    actor_id: str | None
    actor_name: str
    actor_email: str | None
    actor_type: str
    action: str
    target_type: str
    target_id: str
    metadata_json: dict | None
    ip_address: str | None
    created_at: str


class ActivityLogListResponse(BaseModel):
    logs: list[ActivityLogResponse]
    total: int
    page: int
    page_size: int
