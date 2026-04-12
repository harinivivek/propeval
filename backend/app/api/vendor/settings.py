from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import UserType
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services import user_service, vendor_service

router = APIRouter(prefix="/api/vendor/settings", tags=["vendor-settings"])


@router.get("/users", response_model=list[UserResponse])
async def list_org_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no organization")
    all_results = await user_service.list_users_by_org(db, current_user.organization_id)
    start = (page - 1) * page_size
    return all_results[start : start + page_size]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_org_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no organization")
    user = await user_service.create_user(
        db,
        email=payload.email,
        mobile=payload.mobile,
        full_name=payload.full_name,
        password=payload.password,
        user_type=UserType.VENDOR,
        organization_id=current_user.organization_id,
    )
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_org_user(
    user_id: UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    user = await user_service.get_user(db, user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in your organization")
    return await user_service.update_user(db, user, **payload.model_dump(exclude_unset=True))


@router.delete("/users/{user_id}", response_model=UserResponse)
async def deactivate_org_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    user = await user_service.get_user(db, user_id)
    if not user or user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in your organization")
    return await user_service.deactivate_user(db, user)
