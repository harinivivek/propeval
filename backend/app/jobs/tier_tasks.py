"""
Celery tasks for vendor tier management:
- Daily demotion check
- Daily demotion warning (day 15)
"""

import asyncio
from datetime import datetime, timedelta, timezone

from app.jobs.celery_app import celery_app


@celery_app.task(name="check_tier_demotions")
def check_tier_demotions():
    asyncio.run(_check_tier_demotions())


@celery_app.task(name="send_demotion_warnings")
def send_demotion_warnings():
    asyncio.run(_send_demotion_warnings())


async def _check_tier_demotions():
    from app.core.database import get_async_session_context
    from app.models.enums import VendorTier
    from app.models.vendor_profile import VendorProfile
    from sqlalchemy import select

    async with get_async_session_context() as db:
        now = datetime.now(timezone.utc)
        demotion_period = timedelta(days=30)

        # Check VERIFIED vendors for demotion to NEW
        result = await db.execute(
            select(VendorProfile).where(
                VendorProfile.vendor_tier == VendorTier.VERIFIED,
            )
        )
        for profile in result.scalars().all():
            quality = float(profile.quality_score)
            if quality < 60:
                # Check if below threshold for 30 days
                if profile.tier_changed_at and (now - profile.tier_changed_at) > demotion_period:
                    profile.vendor_tier = VendorTier.NEW
                    profile.tier_changed_at = now
                    profile.tier_warning_sent_at = None
                    print(f"Demoted vendor {profile.vendor_id} from VERIFIED to NEW")

        # Check TOP_VALUER vendors for demotion to VERIFIED
        result = await db.execute(
            select(VendorProfile).where(
                VendorProfile.vendor_tier == VendorTier.TOP_VALUER,
            )
        )
        for profile in result.scalars().all():
            quality = float(profile.quality_score)
            if quality < 80:
                if profile.tier_changed_at and (now - profile.tier_changed_at) > demotion_period:
                    profile.vendor_tier = VendorTier.VERIFIED
                    profile.tier_changed_at = now
                    profile.tier_warning_sent_at = None
                    print(f"Demoted vendor {profile.vendor_id} from TOP_VALUER to VERIFIED")

        await db.flush()


async def _send_demotion_warnings():
    from app.core.database import get_async_session_context
    from app.models.enums import VendorTier
    from app.models.vendor_profile import VendorProfile
    from sqlalchemy import select

    async with get_async_session_context() as db:
        now = datetime.now(timezone.utc)
        warning_period = timedelta(days=15)

        # Warn VERIFIED vendors trending toward demotion
        result = await db.execute(
            select(VendorProfile).where(
                VendorProfile.vendor_tier == VendorTier.VERIFIED,
                VendorProfile.tier_warning_sent_at.is_(None),
            )
        )
        for profile in result.scalars().all():
            quality = float(profile.quality_score)
            if quality < 60 and profile.tier_changed_at:
                days_below = (now - profile.tier_changed_at).days
                if days_below >= 15:
                    profile.tier_warning_sent_at = now
                    print(f"Demotion warning sent to vendor {profile.vendor_id} (VERIFIED, score={quality})")

        # Warn TOP_VALUER vendors
        result = await db.execute(
            select(VendorProfile).where(
                VendorProfile.vendor_tier == VendorTier.TOP_VALUER,
                VendorProfile.tier_warning_sent_at.is_(None),
            )
        )
        for profile in result.scalars().all():
            quality = float(profile.quality_score)
            if quality < 80 and profile.tier_changed_at:
                days_below = (now - profile.tier_changed_at).days
                if days_below >= 15:
                    profile.tier_warning_sent_at = now
                    print(f"Demotion warning sent to vendor {profile.vendor_id} (TOP_VALUER, score={quality})")

        await db.flush()
