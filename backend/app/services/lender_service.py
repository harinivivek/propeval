from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import LenderRole, UserType
from app.models.lender import Lender, LenderBranch, LenderUser
from app.models.user import Organization


async def create_lender(db: AsyncSession, name: str, city: str | None = None) -> Lender:
    org = Organization(name=name, type=UserType.LENDER, city=city)
    db.add(org)
    await db.flush()
    lender = Lender(organization_id=org.id, name=name, city=city)
    db.add(lender)
    await db.flush()
    return lender


async def get_lender(db: AsyncSession, lender_id: UUID) -> Lender | None:
    result = await db.execute(
        select(Lender)
        .options(selectinload(Lender.branches), selectinload(Lender.users))
        .where(Lender.id == lender_id)
    )
    return result.scalar_one_or_none()


async def list_lenders(db: AsyncSession) -> list[Lender]:
    result = await db.execute(select(Lender).order_by(Lender.created_at.desc()))
    return list(result.scalars().all())


async def update_lender(db: AsyncSession, lender: Lender, **kwargs) -> Lender:
    for key, value in kwargs.items():
        if value is not None and hasattr(lender, key):
            setattr(lender, key, value)
    await db.flush()
    return lender


async def create_branch(
    db: AsyncSession, lender_id: UUID, name: str, city: str | None = None
) -> LenderBranch:
    branch = LenderBranch(lender_id=lender_id, name=name, city=city)
    db.add(branch)
    await db.flush()
    return branch


async def list_branches(db: AsyncSession, lender_id: UUID) -> list[LenderBranch]:
    result = await db.execute(
        select(LenderBranch)
        .where(LenderBranch.lender_id == lender_id)
        .order_by(LenderBranch.name)
    )
    return list(result.scalars().all())


async def create_lender_user(
    db: AsyncSession,
    user_id: UUID,
    lender_id: UUID,
    role: str,
    branch_ids: list[str] | None = None,
) -> LenderUser:
    lu = LenderUser(
        user_id=user_id,
        lender_id=lender_id,
        role=LenderRole(role),
        branch_ids=branch_ids,
    )
    db.add(lu)
    await db.flush()
    return lu


async def list_lender_users(db: AsyncSession, lender_id: UUID) -> list[LenderUser]:
    result = await db.execute(
        select(LenderUser).where(LenderUser.lender_id == lender_id)
    )
    return list(result.scalars().all())
