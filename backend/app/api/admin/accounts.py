from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.enums import UserType
from app.models.user import User
from app.schemas.lender import (
    BranchCreate,
    BranchResponse,
    LenderCreate,
    LenderResponse,
    LenderUpdate,
    LenderUserCreate,
    LenderUserResponse,
)
from app.schemas.vendor import (
    ServiceAreaCreate,
    ServiceAreaResponse,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
    VendorUserCreate,
    VendorUserResponse,
)
from app.services import lender_service, user_service, vendor_service

router = APIRouter(prefix="/api/admin", tags=["admin-accounts"])


# ── Lenders ──────────────────────────────────────────────────────────────────

@router.get("/lenders", response_model=list[LenderResponse])
async def list_lenders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.list_lenders(db)


@router.post("/lenders", response_model=LenderResponse, status_code=status.HTTP_201_CREATED)
async def create_lender(
    payload: LenderCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.create_lender(db, name=payload.name, city=payload.city)


@router.get("/lenders/{lender_id}", response_model=LenderResponse)
async def get_lender(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    lender = await lender_service.get_lender(db, lender_id)
    if not lender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lender not found")
    return lender


@router.put("/lenders/{lender_id}", response_model=LenderResponse)
async def update_lender(
    lender_id: UUID,
    payload: LenderUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    lender = await lender_service.get_lender(db, lender_id)
    if not lender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lender not found")
    return await lender_service.update_lender(db, lender, **payload.model_dump(exclude_unset=True))


# ── Lender Branches ───────────────────────────────────────────────────────────

@router.get("/lenders/{lender_id}/branches", response_model=list[BranchResponse])
async def list_branches(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.list_branches(db, lender_id)


@router.post(
    "/lenders/{lender_id}/branches",
    response_model=BranchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_branch(
    lender_id: UUID,
    payload: BranchCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    lender = await lender_service.get_lender(db, lender_id)
    if not lender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lender not found")
    return await lender_service.create_branch(db, lender_id=lender_id, name=payload.name, city=payload.city)


# ── Lender Users ──────────────────────────────────────────────────────────────

@router.get("/lenders/{lender_id}/users", response_model=list[LenderUserResponse])
async def list_lender_users(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await lender_service.list_lender_users(db, lender_id)


@router.post(
    "/lenders/{lender_id}/users",
    response_model=LenderUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_lender_user(
    lender_id: UUID,
    payload: LenderUserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    lender = await lender_service.get_lender(db, lender_id)
    if not lender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lender not found")
    user = await user_service.create_user(
        db,
        email=payload.email,
        mobile=payload.mobile,
        full_name=payload.full_name,
        password=payload.password,
        user_type=UserType.LENDER,
        organization_id=lender.organization_id,
    )
    return await lender_service.create_lender_user(
        db,
        user_id=user.id,
        lender_id=lender_id,
        role=payload.role,
        branch_ids=payload.branch_ids,
    )


# ── Vendors ───────────────────────────────────────────────────────────────────

@router.get("/vendors", response_model=list[VendorResponse])
async def list_vendors(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.list_vendors(db)


@router.post("/vendors", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.create_vendor(
        db,
        name=payload.name,
        office_city=payload.office_city,
        office_area=payload.office_area,
        services=payload.services,
    )


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    vendor = await vendor_service.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return vendor


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: UUID,
    payload: VendorUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    vendor = await vendor_service.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return await vendor_service.update_vendor(db, vendor, **payload.model_dump(exclude_unset=True))


# ── Vendor Users ──────────────────────────────────────────────────────────────

@router.get("/vendors/{vendor_id}/users", response_model=list[VendorUserResponse])
async def list_vendor_users(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.list_vendor_users(db, vendor_id)


@router.post(
    "/vendors/{vendor_id}/users",
    response_model=VendorUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vendor_user(
    vendor_id: UUID,
    payload: VendorUserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    vendor = await vendor_service.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    user = await user_service.create_user(
        db,
        email=payload.email,
        mobile=payload.mobile,
        full_name=payload.full_name,
        password=payload.password,
        user_type=UserType.VENDOR,
        organization_id=vendor.organization_id,
    )
    return await vendor_service.create_vendor_user(
        db,
        user_id=user.id,
        vendor_id=vendor_id,
        role=payload.role,
    )


# ── Vendor Service Areas ──────────────────────────────────────────────────────

@router.get("/vendors/{vendor_id}/service-areas", response_model=list[ServiceAreaResponse])
async def list_service_areas(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await vendor_service.list_service_areas(db, vendor_id)


@router.post(
    "/vendors/{vendor_id}/service-areas",
    response_model=ServiceAreaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_service_area(
    vendor_id: UUID,
    payload: ServiceAreaCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    vendor = await vendor_service.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return await vendor_service.create_service_area(
        db,
        vendor_id=vendor_id,
        city=payload.city,
        areas=payload.areas,
        service_type=payload.service_type,
    )
