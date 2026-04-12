import json
from uuid import UUID

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import (
    AUTO_ACCEPT_DAYS,
    MAX_UPLOAD_SIZE_MB,
    REQUIRED_REPORT_FIELDS,
    VENDORS_PER_BROADCAST_ROUND,
    BROADCAST_ACCEPT_WINDOW_MINUTES,
)
from app.models.system_config import SystemConfig

CACHE_KEY = "system_config"
CACHE_TTL = 60  # seconds

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _serialize(config: SystemConfig) -> str:
    return json.dumps({
        "id": str(config.id),
        "vendors_per_broadcast_round": config.vendors_per_broadcast_round,
        "broadcast_accept_window_minutes": config.broadcast_accept_window_minutes,
        "auto_accept_days": config.auto_accept_days,
        "max_upload_size_mb": config.max_upload_size_mb,
        "required_report_fields": config.required_report_fields,
        "updated_by": str(config.updated_by) if config.updated_by else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    })


async def _get_from_cache() -> dict | None:
    r = await _get_redis()
    data = await r.get(CACHE_KEY)
    if data:
        return json.loads(data)
    return None


async def _set_cache(config: SystemConfig) -> None:
    r = await _get_redis()
    await r.set(CACHE_KEY, _serialize(config), ex=CACHE_TTL)


async def _invalidate_cache() -> None:
    r = await _get_redis()
    await r.delete(CACHE_KEY)


async def get_system_config(db: AsyncSession) -> SystemConfig:
    """Get system config from DB (cache is used by get_config_values for perf)."""
    result = await db.execute(select(SystemConfig).limit(1))
    config = result.scalar_one_or_none()
    if config is None:
        config = SystemConfig(
            vendors_per_broadcast_round=VENDORS_PER_BROADCAST_ROUND,
            broadcast_accept_window_minutes=BROADCAST_ACCEPT_WINDOW_MINUTES,
            auto_accept_days=AUTO_ACCEPT_DAYS,
            max_upload_size_mb=MAX_UPLOAD_SIZE_MB,
            required_report_fields=list(REQUIRED_REPORT_FIELDS),
        )
        db.add(config)
        await db.flush()
    await _set_cache(config)
    return config


async def get_config_values() -> dict:
    """Get config as dict — uses Redis cache, falls back to defaults.
    Use this in services that only need values (no DB session needed for cache hit).
    """
    cached = await _get_from_cache()
    if cached:
        return cached
    return {
        "vendors_per_broadcast_round": VENDORS_PER_BROADCAST_ROUND,
        "broadcast_accept_window_minutes": BROADCAST_ACCEPT_WINDOW_MINUTES,
        "auto_accept_days": AUTO_ACCEPT_DAYS,
        "max_upload_size_mb": MAX_UPLOAD_SIZE_MB,
        "required_report_fields": list(REQUIRED_REPORT_FIELDS),
    }


async def update_system_config(
    db: AsyncSession, *, updates: dict, updated_by: UUID
) -> SystemConfig:
    config = await get_system_config(db)
    for key, value in updates.items():
        if value is not None and hasattr(config, key):
            setattr(config, key, value)
    config.updated_by = updated_by
    await db.flush()
    await _invalidate_cache()
    return config
