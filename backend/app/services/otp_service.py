import logging
import random
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


async def send_otp(mobile: str) -> str:
    otp = generate_otp()
    r = await get_redis()
    await r.set(f"otp:{mobile}", otp, ex=settings.OTP_EXPIRE_MINUTES * 60)
    logger.info(f"[MOCK SMS] OTP for {mobile}: {otp}")
    return otp


async def verify_otp(mobile: str, otp: str) -> bool:
    if settings.APP_ENV in ("local", "dev") and otp == settings.DEV_OTP:
        return True
    r = await get_redis()
    stored = await r.get(f"otp:{mobile}")
    if stored and stored == otp:
        await r.delete(f"otp:{mobile}")
        return True
    return False
