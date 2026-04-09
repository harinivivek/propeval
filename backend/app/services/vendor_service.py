from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import ServiceType, UserType, VendorRole
from app.models.user import Organization
from app.models.vendor import ServiceArea, Vendor, VendorUser


async def create_vendor(
    db: AsyncSession,
    name: str,
    office_city: str | None = None,
    office_area: str | None = None,
    services: list[str] | None = None,
) -> Vendor:
    org = Organization(name=name, type=UserType.VENDOR, city=office_city)
    db.add(org)
    await db.flush()
    vendor = Vendor(
        organization_id=org.id,
        name=name,
        office_city=office_city,
        office_area=office_area,
        services=services,
    )
    db.add(vendor)
    await db.flush()
    return vendor


async def get_vendor(db: AsyncSession, vendor_id: UUID) -> Vendor | None:
    result = await db.execute(
        select(Vendor)
        .options(selectinload(Vendor.users), selectinload(Vendor.service_areas))
        .where(Vendor.id == vendor_id)
    )
    return result.scalar_one_or_none()


async def list_vendors(db: AsyncSession) -> list[Vendor]:
    result = await db.execute(select(Vendor).order_by(Vendor.created_at.desc()))
    return list(result.scalars().all())


async def update_vendor(db: AsyncSession, vendor: Vendor, **kwargs) -> Vendor:
    for key, value in kwargs.items():
        if value is not None and hasattr(vendor, key):
            setattr(vendor, key, value)
    await db.flush()
    return vendor


async def create_vendor_user(
    db: AsyncSession, user_id: UUID, vendor_id: UUID, role: str
) -> VendorUser:
    vu = VendorUser(user_id=user_id, vendor_id=vendor_id, role=VendorRole(role))
    db.add(vu)
    await db.flush()
    return vu


async def list_vendor_users(db: AsyncSession, vendor_id: UUID) -> list[VendorUser]:
    result = await db.execute(
        select(VendorUser).where(VendorUser.vendor_id == vendor_id)
    )
    return list(result.scalars().all())


async def create_service_area(
    db: AsyncSession,
    vendor_id: UUID,
    city: str,
    areas: list[str] | None = None,
    service_type: str = "VALUATION",
) -> ServiceArea:
    sa = ServiceArea(
        vendor_id=vendor_id,
        city=city,
        areas=areas,
        service_type=ServiceType(service_type),
    )
    db.add(sa)
    await db.flush()
    return sa


async def list_service_areas(db: AsyncSession, vendor_id: UUID) -> list[ServiceArea]:
    result = await db.execute(
        select(ServiceArea).where(ServiceArea.vendor_id == vendor_id)
    )
    return list(result.scalars().all())
