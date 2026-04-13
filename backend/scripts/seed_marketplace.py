"""
Seed marketplace data: vendor profiles, localities, and price bands.

Run: docker compose -f docker-compose.local.yml --env-file .env.local exec backend python -m scripts.seed_marketplace
"""

import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.core.database import get_async_session_context
from app.models.enums import PropertyType, ReportCategory, VendorTier
from app.models.locality import Locality
from app.models.price_band import PriceBand
from app.models.vendor import Vendor
from app.models.vendor_profile import VendorProfile


VENDOR_PROFILES = {
    "ValuePro Consultants": {
        "bio": "Leading property valuation firm with over 15 years of experience across South India. Specializing in residential and commercial properties in Bengaluru and Chennai metro areas.",
        "founding_year": 2010,
        "certifications": {"ibbi_registration": "IBBI/RV/06/2019/12345", "other": "RICS Certified"},
        "specialization_tags": ["Residential", "Commercial", "Heritage Properties"],
        "quality_score": Decimal("78.50"),
        "vendor_tier": VendorTier.VERIFIED,
    },
    "PropAssess India": {
        "bio": "Pan-India valuation services for banks and NBFCs. Quick turnaround and AI-assisted reporting.",
        "founding_year": 2016,
        "certifications": {"ibbi_registration": "IBBI/RV/06/2020/23456"},
        "specialization_tags": ["Residential", "Industrial", "Plot Assessment"],
        "quality_score": Decimal("65.00"),
        "vendor_tier": VendorTier.VERIFIED,
    },
    "LegalEye Associates": {
        "bio": "Property title search and legal due diligence experts. Over 2000 title reports delivered for major banks.",
        "founding_year": 2012,
        "certifications": {"bar_council": "KAR/2012/4567", "other": "Member, Property Law Society"},
        "specialization_tags": ["Legal Due Diligence", "Title Search", "Commercial"],
        "quality_score": Decimal("85.20"),
        "vendor_tier": VendorTier.TOP_VALUER,
    },
    "SouthVal Services": {
        "bio": "New valuation firm focused on residential properties in South Bengaluru. IBBI registered.",
        "founding_year": 2024,
        "certifications": {"ibbi_registration": "IBBI/RV/06/2024/78901"},
        "specialization_tags": ["Residential", "New Construction"],
        "quality_score": Decimal("42.00"),
        "vendor_tier": VendorTier.NEW,
    },
}

LOCALITIES = [
    ("Koramangala", "560034", "Bengaluru", "Karnataka", Decimal("12.9352"), Decimal("77.6245")),
    ("Indiranagar", "560038", "Bengaluru", "Karnataka", Decimal("12.9784"), Decimal("77.6408")),
    ("HSR Layout", "560102", "Bengaluru", "Karnataka", Decimal("12.9116"), Decimal("77.6389")),
    ("Whitefield", "560066", "Bengaluru", "Karnataka", Decimal("12.9698"), Decimal("77.7500")),
    ("Jayanagar", "560041", "Bengaluru", "Karnataka", Decimal("12.9308"), Decimal("77.5838")),
    ("JP Nagar", "560078", "Bengaluru", "Karnataka", Decimal("12.9063"), Decimal("77.5857")),
    ("Marathahalli", "560037", "Bengaluru", "Karnataka", Decimal("12.9591"), Decimal("77.7010")),
    ("Electronic City", "560100", "Bengaluru", "Karnataka", Decimal("12.8440"), Decimal("77.6712")),
    ("Rajajinagar", "560010", "Bengaluru", "Karnataka", Decimal("12.9900"), Decimal("77.5563")),
    ("Bannerghatta Road", "560076", "Bengaluru", "Karnataka", Decimal("12.8879"), Decimal("77.5967")),
    ("Andheri West", "400058", "Mumbai", "Maharashtra", Decimal("19.1364"), Decimal("72.8296")),
    ("Bandra West", "400050", "Mumbai", "Maharashtra", Decimal("19.0596"), Decimal("72.8295")),
    ("Powai", "400076", "Mumbai", "Maharashtra", Decimal("19.1176"), Decimal("72.9060")),
    ("Worli", "400018", "Mumbai", "Maharashtra", Decimal("19.0176"), Decimal("72.8150")),
    ("Goregaon East", "400063", "Mumbai", "Maharashtra", Decimal("19.1663"), Decimal("72.8526")),
    ("Malad West", "400064", "Mumbai", "Maharashtra", Decimal("19.1872"), Decimal("72.8344")),
    ("Thane West", "400601", "Mumbai", "Maharashtra", Decimal("19.2183"), Decimal("72.9781")),
    ("Navi Mumbai", "400706", "Mumbai", "Maharashtra", Decimal("19.0330"), Decimal("73.0297")),
    ("Dwarka", "110075", "Delhi", "Delhi", Decimal("28.5921"), Decimal("77.0460")),
    ("Saket", "110017", "Delhi", "Delhi", Decimal("28.5244"), Decimal("77.2066")),
    ("Rohini", "110085", "Delhi", "Delhi", Decimal("28.7495"), Decimal("77.0566")),
    ("Noida Sector 62", "201301", "Delhi", "Uttar Pradesh", Decimal("28.6270"), Decimal("77.3649")),
    ("Gurgaon Sector 49", "122018", "Delhi", "Haryana", Decimal("28.4134"), Decimal("77.0429")),
    ("Greater Kailash", "110048", "Delhi", "Delhi", Decimal("28.5494"), Decimal("77.2425")),
    ("Adyar", "600020", "Chennai", "Tamil Nadu", Decimal("13.0067"), Decimal("80.2574")),
    ("T Nagar", "600017", "Chennai", "Tamil Nadu", Decimal("13.0418"), Decimal("80.2341")),
    ("Velachery", "600042", "Chennai", "Tamil Nadu", Decimal("12.9815"), Decimal("80.2180")),
    ("Anna Nagar", "600040", "Chennai", "Tamil Nadu", Decimal("13.0850"), Decimal("80.2101")),
    ("OMR Thoraipakkam", "600097", "Chennai", "Tamil Nadu", Decimal("12.9355"), Decimal("80.2282")),
    ("Porur", "600116", "Chennai", "Tamil Nadu", Decimal("13.0382"), Decimal("80.1565")),
]

PRICE_BANDS = [
    ("Bengaluru", "RESIDENTIAL", "VALUATION", Decimal("2000"), Decimal("6000")),
    ("Bengaluru", "COMMERCIAL", "VALUATION", Decimal("4000"), Decimal("10000")),
    ("Bengaluru", "RESIDENTIAL", "LEGAL", Decimal("1500"), Decimal("5000")),
    ("Mumbai", "RESIDENTIAL", "VALUATION", Decimal("3000"), Decimal("8000")),
    ("Mumbai", "COMMERCIAL", "VALUATION", Decimal("5000"), Decimal("15000")),
    ("Mumbai", "RESIDENTIAL", "LEGAL", Decimal("2000"), Decimal("6000")),
    ("Delhi", "RESIDENTIAL", "VALUATION", Decimal("2500"), Decimal("7000")),
    ("Delhi", "COMMERCIAL", "VALUATION", Decimal("4000"), Decimal("12000")),
    ("Chennai", "RESIDENTIAL", "VALUATION", Decimal("2000"), Decimal("5500")),
    ("Chennai", "RESIDENTIAL", "LEGAL", Decimal("1500"), Decimal("4500")),
]


async def seed_marketplace() -> None:
    async with get_async_session_context() as db:

        # 1. Vendor profiles
        profile_count = 0
        vendors_result = await db.execute(select(Vendor))
        for vendor in vendors_result.scalars().all():
            existing = await db.execute(
                select(VendorProfile).where(VendorProfile.vendor_id == vendor.id)
            )
            if existing.scalar_one_or_none():
                continue

            profile_data = VENDOR_PROFILES.get(vendor.name, {})
            if not profile_data:
                # Default profile for unknown vendors
                profile_data = {
                    "bio": f"{vendor.name} — property services provider.",
                    "quality_score": Decimal("50.00"),
                    "vendor_tier": VendorTier.NEW,
                    "specialization_tags": ["Residential"],
                }

            profile = VendorProfile(
                vendor_id=vendor.id,
                bio=profile_data.get("bio"),
                founding_year=profile_data.get("founding_year"),
                certifications=profile_data.get("certifications"),
                specialization_tags=profile_data.get("specialization_tags"),
                quality_score=profile_data.get("quality_score", Decimal("50.00")),
                vendor_tier=profile_data.get("vendor_tier", VendorTier.NEW),
                profile_completeness=80 if profile_data.get("certifications") else 40,
            )
            db.add(profile)
            profile_count += 1

        await db.flush()
        print(f"Created {profile_count} vendor profiles")

        # 2. Localities
        loc_count = 0
        for name, pin_code, city, state, lat, lng in LOCALITIES:
            existing = await db.execute(
                select(Locality).where(Locality.name == name, Locality.pin_code == pin_code)
            )
            if existing.scalar_one_or_none():
                continue
            db.add(Locality(name=name, pin_code=pin_code, city=city, state=state, lat=lat, lng=lng))
            loc_count += 1

        await db.flush()
        print(f"Created {loc_count} localities")

        # 3. Price bands
        band_count = 0
        for city, pt, rc, min_p, max_p in PRICE_BANDS:
            existing = await db.execute(
                select(PriceBand).where(
                    PriceBand.city == city,
                    PriceBand.property_type == PropertyType(pt),
                    PriceBand.report_category == ReportCategory(rc),
                )
            )
            if existing.scalar_one_or_none():
                continue
            db.add(PriceBand(
                city=city,
                property_type=PropertyType(pt),
                report_category=ReportCategory(rc),
                min_price=min_p,
                max_price=max_p,
            ))
            band_count += 1

        await db.flush()
        print(f"Created {band_count} price bands")

        print("\nMarketplace seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_marketplace())
