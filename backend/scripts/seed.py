"""
Seed script for PropEval.

Run from the backend directory:
    python -m scripts.seed
"""

import asyncio

from app.core.database import get_async_session_context
from app.models.enums import AdminRole, LenderRole, UserType, VendorRole
from app.models.user import Organization
from app.services import lender_service, user_service, vendor_service


async def seed() -> None:
    async with get_async_session_context() as db:
        # ── GTR Admin org + user ──────────────────────────────────────────────
        admin_org = Organization(name="Get-It-Right", type=UserType.ADMIN)
        db.add(admin_org)
        await db.flush()

        admin_user = await user_service.create_user(
            db,
            email="admin@getitright.com",
            mobile="9000000001",
            full_name="GTR Admin",
            password="admin123",
            user_type=UserType.ADMIN,
            organization_id=admin_org.id,
        )
        print(f"Created admin user: {admin_user.email} (id={admin_user.id})")

        # ── Sample lender: ABCL Bank ──────────────────────────────────────────
        lender = await lender_service.create_lender(
            db, name="ABCL Bank", city="Bengaluru"
        )
        print(f"Created lender: {lender.name} (id={lender.id})")

        branch = await lender_service.create_branch(
            db, lender_id=lender.id, name="Koramangala Branch", city="Bengaluru"
        )
        print(f"Created branch: {branch.name} (id={branch.id})")

        lender_user = await user_service.create_user(
            db,
            email="lender@abcl.com",
            mobile="9000000002",
            full_name="ABCL Lender",
            password="lender123",
            user_type=UserType.LENDER,
            organization_id=lender.organization_id,
        )
        await lender_service.create_lender_user(
            db,
            user_id=lender_user.id,
            lender_id=lender.id,
            role=LenderRole.ORG_ADMIN,
            branch_ids=[str(branch.id)],
        )
        print(f"Created lender user: {lender_user.email} (id={lender_user.id})")

        # ── Sample vendor: ValuePro Consultants ───────────────────────────────
        vendor = await vendor_service.create_vendor(
            db,
            name="ValuePro Consultants",
            office_city="Bengaluru",
            office_area="Koramangala",
            services=["VALUATION"],
        )
        print(f"Created vendor: {vendor.name} (id={vendor.id})")

        await vendor_service.create_service_area(
            db,
            vendor_id=vendor.id,
            city="Bengaluru",
            areas=["Koramangala", "Indiranagar", "HSR Layout"],
            service_type="VALUATION",
        )

        vendor_user = await user_service.create_user(
            db,
            email="vendor@valuepro.com",
            mobile="9000000003",
            full_name="ValuePro Vendor",
            password="vendor123",
            user_type=UserType.VENDOR,
            organization_id=vendor.organization_id,
        )
        await vendor_service.create_vendor_user(
            db,
            user_id=vendor_user.id,
            vendor_id=vendor.id,
            role=VendorRole.VENDOR_ADMIN,
        )
        print(f"Created vendor user: {vendor_user.email} (id={vendor_user.id})")

        print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
