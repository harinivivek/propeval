"""
Seed localities for marketplace search.

Run from the backend directory:
    python -m scripts.seed_localities
"""

import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.core.database import get_async_session_context
from app.models.locality import Locality

LOCALITIES = [
    # Bengaluru
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
    # Mumbai
    ("Andheri West", "400058", "Mumbai", "Maharashtra", Decimal("19.1364"), Decimal("72.8296")),
    ("Bandra West", "400050", "Mumbai", "Maharashtra", Decimal("19.0596"), Decimal("72.8295")),
    ("Powai", "400076", "Mumbai", "Maharashtra", Decimal("19.1176"), Decimal("72.9060")),
    ("Worli", "400018", "Mumbai", "Maharashtra", Decimal("19.0176"), Decimal("72.8150")),
    ("Goregaon East", "400063", "Mumbai", "Maharashtra", Decimal("19.1663"), Decimal("72.8526")),
    ("Malad West", "400064", "Mumbai", "Maharashtra", Decimal("19.1872"), Decimal("72.8344")),
    ("Thane West", "400601", "Mumbai", "Maharashtra", Decimal("19.2183"), Decimal("72.9781")),
    ("Navi Mumbai", "400706", "Mumbai", "Maharashtra", Decimal("19.0330"), Decimal("73.0297")),
    # Delhi NCR
    ("Dwarka", "110075", "Delhi", "Delhi", Decimal("28.5921"), Decimal("77.0460")),
    ("Saket", "110017", "Delhi", "Delhi", Decimal("28.5244"), Decimal("77.2066")),
    ("Rohini", "110085", "Delhi", "Delhi", Decimal("28.7495"), Decimal("77.0566")),
    ("Noida Sector 62", "201301", "Delhi", "Uttar Pradesh", Decimal("28.6270"), Decimal("77.3649")),
    ("Gurgaon Sector 49", "122018", "Delhi", "Haryana", Decimal("28.4134"), Decimal("77.0429")),
    ("Greater Kailash", "110048", "Delhi", "Delhi", Decimal("28.5494"), Decimal("77.2425")),
    # Chennai
    ("Adyar", "600020", "Chennai", "Tamil Nadu", Decimal("13.0067"), Decimal("80.2574")),
    ("T Nagar", "600017", "Chennai", "Tamil Nadu", Decimal("13.0418"), Decimal("80.2341")),
    ("Velachery", "600042", "Chennai", "Tamil Nadu", Decimal("12.9815"), Decimal("80.2180")),
    ("Anna Nagar", "600040", "Chennai", "Tamil Nadu", Decimal("13.0850"), Decimal("80.2101")),
    ("OMR Thoraipakkam", "600097", "Chennai", "Tamil Nadu", Decimal("12.9355"), Decimal("80.2282")),
    ("Porur", "600116", "Chennai", "Tamil Nadu", Decimal("13.0382"), Decimal("80.1565")),
]


async def seed_localities() -> None:
    async with get_async_session_context() as db:
        count = 0
        for name, pin_code, city, state, lat, lng in LOCALITIES:
            existing = await db.execute(
                select(Locality).where(
                    Locality.name == name,
                    Locality.pin_code == pin_code,
                )
            )
            if existing.scalar_one_or_none():
                continue

            db.add(Locality(
                name=name,
                pin_code=pin_code,
                city=city,
                state=state,
                lat=lat,
                lng=lng,
            ))
            count += 1

        await db.flush()
        print(f"Seeded {count} localities (skipped {len(LOCALITIES) - count} existing).")


if __name__ == "__main__":
    asyncio.run(seed_localities())
