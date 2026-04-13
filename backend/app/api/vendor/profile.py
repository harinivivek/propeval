import os
import uuid as uuid_mod
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.vendor_profile import (
    VendorProfileResponse,
    VendorProfileUpdate,
    TierProgressResponse,
)
from app.services import vendor_profile_service

router = APIRouter(prefix="/api/vendor/profile", tags=["vendor-profile"])

UPLOAD_DIR = "/app/uploads/vendor_photos"


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    )
    vendor_id = result.scalar_one_or_none()
    if not vendor_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_id


@router.get("", response_model=VendorProfileResponse)
async def get_own_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    profile = await vendor_profile_service.get_or_create_profile(db, vendor_id)
    return profile


@router.put("", response_model=VendorProfileResponse)
async def update_own_profile(
    body: VendorProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    updates = body.model_dump(exclude_unset=True)
    profile = await vendor_profile_service.update_profile(
        db, vendor_id, updates=updates
    )
    return profile


@router.post("/photo", response_model=VendorProfileResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are allowed")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{uuid_mod.uuid4()}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    profile = await vendor_profile_service.upload_profile_photo(
        db, vendor_id, f"/uploads/vendor_photos/{filename}"
    )
    return profile


@router.get("/tier", response_model=TierProgressResponse)
async def get_tier_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    progress = await vendor_profile_service.get_tier_progress(db, vendor_id)
    return progress
