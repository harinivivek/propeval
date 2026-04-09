from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User


async def create_user(
    db: AsyncSession,
    email: str,
    mobile: str,
    full_name: str,
    password: str,
    user_type: str,
    organization_id: UUID | None = None,
) -> User:
    user = User(
        email=email,
        mobile=mobile,
        full_name=full_name,
        password_hash=hash_password(password),
        user_type=user_type,
        organization_id=organization_id,
    )
    db.add(user)
    await db.flush()
    return user


async def get_user(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: User, **kwargs) -> User:
    for key, value in kwargs.items():
        if value is not None and hasattr(user, key):
            setattr(user, key, value)
    await db.flush()
    return user


async def list_users_by_org(db: AsyncSession, organization_id: UUID) -> list[User]:
    result = await db.execute(
        select(User)
        .where(User.organization_id == organization_id)
        .order_by(User.created_at.desc())
    )
    return list(result.scalars().all())


async def deactivate_user(db: AsyncSession, user: User) -> User:
    user.is_active = False
    await db.flush()
    return user
