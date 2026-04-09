from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password, verify_token
from app.models.user import User
from app.services.otp_service import send_otp, verify_otp


async def authenticate_email(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if user and verify_password(password, user.password_hash):
        return user
    return None


async def authenticate_otp(db: AsyncSession, mobile: str, otp: str) -> User | None:
    is_valid = await verify_otp(mobile, otp)
    if not is_valid:
        return None
    result = await db.execute(select(User).where(User.mobile == mobile, User.is_active == True))
    return result.scalar_one_or_none()


async def request_otp(db: AsyncSession, mobile: str) -> bool:
    result = await db.execute(select(User).where(User.mobile == mobile, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        return False
    await send_otp(mobile)
    return True


def generate_tokens(user: User) -> dict:
    access = create_access_token(str(user.id), [user.user_type])
    refresh = create_refresh_token(str(user.id))
    return {"access_token": access, "refresh_token": refresh}


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> dict | None:
    payload = verify_token(refresh_token)
    if payload.get("type") != "refresh":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == UUID(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        return None
    return {"access_token": create_access_token(str(user.id), [user.user_type])}


async def check_dual_role(db: AsyncSession, user: User) -> bool:
    return user.user_type == "ADMIN"


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_mobile(db: AsyncSession, mobile: str) -> User | None:
    result = await db.execute(select(User).where(User.mobile == mobile))
    return result.scalar_one_or_none()


async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
    payload = verify_token(token)
    if payload.get("type") != "reset":
        return False
    user_id = payload.get("sub")
    if not user_id:
        return False
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        return False
    user.password_hash = hash_password(new_password)
    await db.flush()
    return True
