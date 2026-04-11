# Phase 9: Map Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive Leaflet map views — a map/list toggle on the lender listings page and a dedicated vendor coverage map with own reports (green) vs competitor density (red).

**Architecture:** Add lat/lng to the Listing model, create two new map API endpoints (lender listings map + vendor coverage map), build React Leaflet map components with SSR-disabled dynamic imports, and update seed data with realistic geocoordinates across 4 Indian cities.

**Tech Stack:** Leaflet, React Leaflet, react-leaflet-markercluster, Next.js dynamic imports (ssr: false)

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|----------------|
| `backend/app/api/vendor/map.py` | Vendor coverage map API endpoint |
| `backend/alembic/versions/XXXX_add_listing_coordinates.py` | Migration for listing lat/lng |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/listing.py` | Add latitude/longitude fields |
| `backend/app/models/__init__.py` | No change needed (Listing already registered) |
| `backend/app/services/listing_service.py` | Add map data function, update coordinate averaging |
| `backend/app/api/lender/listings.py` | Add map endpoint |
| `backend/app/main.py` | Register vendor map router |
| `backend/scripts/seed_demo.py` | Add geocoordinates to all reports + listing coordinate averaging |

### Frontend — New Files
| File | Responsibility |
|------|----------------|
| `frontend/src/components/map-wrapper.tsx` | Dynamic-imported Leaflet map wrapper (SSR-safe) |
| `frontend/src/app/lender/listings/_components/listings-map.tsx` | Lender listings map with clustering |
| `frontend/src/app/vendor/map/page.tsx` | Vendor coverage map page |
| `frontend/src/types/map.ts` | TypeScript interfaces for map data |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/app/lender/listings/page.tsx` | Add map/list toggle, conditional rendering |
| `frontend/src/app/vendor/layout.tsx` | Add "Coverage Map" to sidebar nav |
| `frontend/package.json` | Add leaflet, react-leaflet, markercluster deps |

---

## Task 1: Add Coordinates to Listing Model + Migration

**Files:**
- Modify: `backend/app/models/listing.py`
- Create: Alembic migration

- [ ] **Step 1: Add latitude/longitude fields to Listing model**

In `backend/app/models/listing.py`, add `Numeric` to the imports from sqlalchemy:

```python
from sqlalchemy import (
    Boolean,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
```

Add `from decimal import Decimal` at the top.

Then add these two fields after `latest_report_date` (before `is_active`):

```python
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
```

- [ ] **Step 2: Generate and run Alembic migration**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic revision --autogenerate -m "add listing coordinates"
docker cp propeval-backend-1:/app/alembic/versions/<generated_file>.py backend/alembic/versions/
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic upgrade head
```

Verify:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec postgres psql -U propeval -d propeval -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'listings' AND column_name IN ('latitude', 'longitude');"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/listing.py backend/alembic/versions/
git commit -m "feat(phase9): add latitude/longitude to Listing model"
```

---

## Task 2: Add Geocoordinates to Seed Data

**Files:**
- Modify: `backend/scripts/seed_demo.py`

- [ ] **Step 1: Add latitude/longitude to report_specs and Report creation**

In `backend/scripts/seed_demo.py`, update the `report_specs` tuple format to add lat/lng as the last two elements. The comment on line 232 becomes:

```python
        # (vendor, category, city, pin_code, property_type, status, valuation_amount, days_ago, listing_approved, applicant, address, macro_location, latitude, longitude)
```

Update each report_spec entry to add coordinates. Here are the updated entries:

```python
        report_specs = [
            # ValuePro — Bengaluru
            (valuepro_vendor, "VALUATION", "Bengaluru", "560034", "RESIDENTIAL", "PUBLISHED", "4500000", 180, True, "Rajesh Kumar", "12/3, 5th Cross, Koramangala 4th Block", "Koramangala", "12.9352", "77.6245"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560034", "RESIDENTIAL", "PUBLISHED", "7800000", 150, True, "Priya Sharma", "45, 8th Main, Koramangala 6th Block", "Koramangala", "12.9340", "77.6218"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560038", "COMMERCIAL", "PUBLISHED", "25000000", 120, True, "Sunita Patel", "103, HSR Layout, Sector 2", "HSR Layout", "12.9116", "77.6389"),
            (valuepro_vendor, "LEGAL", "Bengaluru", "560034", "RESIDENTIAL", "PUBLISHED", None, 90, True, "Amit Verma", "78, 3rd Main, Koramangala 5th Block", "Koramangala", "12.9346", "77.6230"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560071", "RESIDENTIAL", "PUBLISHED", "3200000", 60, True, "Deepa Nair", "22, 15th Cross, Jayanagar 4th Block", "Jayanagar", "12.9250", "77.5838"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560038", "RESIDENTIAL", "READY_TO_PUBLISH", "5500000", 30, False, "Mohan Rao", "56, Sector 7, HSR Layout", "HSR Layout", "12.9081", "77.6476"),
            (valuepro_vendor, "LEGAL", "Bengaluru", "560071", "COMMERCIAL", "PROCESSING", None, 10, False, "Kavitha Reddy", "88, 2nd Main, Jayanagar 3rd Block", "Jayanagar", "12.9263", "77.5821"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560008", "RESIDENTIAL", "UPLOADED", "2800000", 5, False, "Suresh Babu", "14/A, Indiranagar 1st Stage", "Indiranagar", "12.9784", "77.6408"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560034", "INDUSTRIAL", "PUBLISHED", "18000000", 200, True, "Ganesh Iyer", "Plot 7, Industrial Estate, Koramangala", "Koramangala", "12.9310", "77.6195"),
            (valuepro_vendor, "LEGAL", "Bengaluru", "560038", "RESIDENTIAL", "ARCHIVED", None, 365, False, "Lakshmi Devi", "33, 10th Main, HSR Layout", "HSR Layout", "12.9135", "77.6412"),

            # PropAssess — Mumbai
            (propassess, "VALUATION", "Mumbai", "400050", "RESIDENTIAL", "PUBLISHED", "9500000", 160, True, "Anil Mehta", "B-204, Sea View Apartments, Bandra West", "Bandra", "19.0596", "72.8295"),
            (propassess, "VALUATION", "Mumbai", "400050", "RESIDENTIAL", "PUBLISHED", "12000000", 130, True, "Neha Joshi", "A-301, Sai Kripa, Bandra East", "Bandra", "19.0544", "72.8402"),
            (propassess, "VALUATION", "Mumbai", "400053", "COMMERCIAL", "PUBLISHED", "45000000", 100, True, "Ramesh Shah", "Unit 5, Andheri Industrial Area", "Andheri", "19.1136", "72.8697"),
            (propassess, "LEGAL", "Mumbai", "400050", "RESIDENTIAL", "PUBLISHED", None, 80, True, "Pooja Kulkarni", "C-102, Palm Grove, Bandra", "Bandra", "19.0570", "72.8350"),
            (propassess, "VALUATION", "Mumbai", "400092", "RESIDENTIAL", "PUBLISHED", "6800000", 55, True, "Vijay Patil", "12, Borivali East, Sector 4", "Borivali", "19.2307", "72.8567"),
            (propassess, "VALUATION", "Mumbai", "400053", "RESIDENTIAL", "READY_TO_PUBLISH", "8200000", 25, False, "Suman Ghosh", "301, Skyline Heights, Andheri West", "Andheri", "19.1197", "72.8463"),
            (propassess, "LEGAL", "Mumbai", "400092", "COMMERCIAL", "PROCESSING", None, 12, False, "Hema Sawant", "Office 7, Borivali Commercial Plaza", "Borivali", "19.2283", "72.8591"),
            (propassess, "VALUATION", "Mumbai", "400028", "RESIDENTIAL", "UPLOADED", "15000000", 3, False, "Prakash Desai", "5A, Dadar Tilak Bridge Road", "Dadar", "19.0178", "72.8478"),

            # LegalEye — Delhi
            (legaleye, "LEGAL", "Delhi", "110017", "RESIDENTIAL", "PUBLISHED", None, 170, True, "Manish Gupta", "14, Saket Block C, South Delhi", "Saket", "28.5244", "77.2090"),
            (legaleye, "LEGAL", "Delhi", "110045", "RESIDENTIAL", "PUBLISHED", None, 140, True, "Reema Singh", "8, Pocket 3, Dwarka Sector 10", "Dwarka", "28.5823", "77.0500"),
            (legaleye, "LEGAL", "Delhi", "110085", "COMMERCIAL", "PUBLISHED", None, 110, True, "Alok Sharma", "Shop 22, Rohini Sector 7 Market", "Rohini", "28.7150", "77.1144"),
            (legaleye, "LEGAL", "Delhi", "110070", "RESIDENTIAL", "PUBLISHED", None, 75, True, "Sunita Tiwari", "Block A, Vasant Kunj Flat 203", "Vasant Kunj", "28.5205", "77.1567"),
            (legaleye, "LEGAL", "Delhi", "110017", "COMMERCIAL", "READY_TO_PUBLISH", None, 20, False, "Ashok Yadav", "Office 15, Saket District Centre", "Saket", "28.5270", "77.2127"),
            (legaleye, "LEGAL", "Delhi", "110045", "RESIDENTIAL", "PROCESSING", None, 8, False, "Meena Kapoor", "Flat 506, Dwarka Sector 12", "Dwarka", "28.5890", "77.0378"),

            # SouthVal — Chennai
            (southval, "VALUATION", "Chennai", "600017", "RESIDENTIAL", "PUBLISHED", "5200000", 190, True, "Krishnamurthy R", "23, T. Nagar 3rd Lane", "T. Nagar", "13.0418", "80.2341"),
            (southval, "VALUATION", "Chennai", "600020", "RESIDENTIAL", "PUBLISHED", "4800000", 145, True, "Saranya K", "6/2, Adyar Lattice Bridge Road", "Adyar", "13.0067", "80.2565"),
            (southval, "VALUATION", "Chennai", "600042", "COMMERCIAL", "PUBLISHED", "28000000", 105, True, "Venkat S", "Plot 44, Velachery Main Road", "Velachery", "12.9815", "80.2180"),
            (southval, "VALUATION", "Chennai", "600004", "RESIDENTIAL", "PUBLISHED", "6100000", 70, True, "Usha Rajan", "18, Mylapore 4th Street", "Mylapore", "13.0339", "80.2691"),
            (southval, "VALUATION", "Chennai", "600017", "AGRICULTURAL", "READY_TO_PUBLISH", "12000000", 22, False, "Balasubramaniam P", "Survey No 45, Poonamallee Road", "T. Nagar", "13.0450", "80.2290"),
            (southval, "VALUATION", "Chennai", "600020", "RESIDENTIAL", "UPLOADED", "3900000", 4, False, "Padma Vijay", "44, Adyar River View Apartments", "Adyar", "13.0035", "80.2598"),
            (southval, "VALUATION", "Chennai", "600042", "INDUSTRIAL", "PUBLISHED", "55000000", 230, True, "Raghunath T", "Industrial Plot 9, Velachery Industrial Estate", "Velachery", "12.9780", "80.2210"),
        ]
```

- [ ] **Step 2: Update the Report creation loop to use lat/lng**

Update the unpacking and Report creation (lines 275-293):

```python
        reports = []
        for spec in report_specs:
            (vendor_obj, cat, city_name, pin, ptype, status, val_amt, days, lst_approved, applicant, address, macro, lat, lng) = spec
            r = Report(
                vendor_id=vendor_obj.id,
                report_category=ReportCategory(cat),
                status=ReportStatus(status),
                property_address=address,
                macro_location=macro,
                city=city_name,
                pin_code=pin,
                property_type=PropertyType(ptype),
                valuation_amount=Decimal(val_amt) if val_amt else None,
                loan_applicant_name=applicant,
                report_date=date_ago(days),
                listing_approved=lst_approved,
                is_active=True,
                latitude=Decimal(lat),
                longitude=Decimal(lng),
            )
            db.add(r)
            reports.append(r)
        await db.flush()
        print(f"  Created {len(reports)} reports.")
```

- [ ] **Step 3: Add coordinate averaging to listing creation**

In the listing creation section (after line 300), update the listing creation loop to compute averaged coordinates. Replace the existing listing creation block with:

```python
        listing_map: dict[tuple, Listing] = {}
        listing_report_entries = []

        for rpt in reports:
            if rpt.status == ReportStatus.PUBLISHED and rpt.listing_approved:
                key = (rpt.pin_code, rpt.property_type)
                if key not in listing_map:
                    listing_map[key] = Listing(
                        macro_location=rpt.macro_location or "",
                        city=rpt.city or "",
                        pin_code=rpt.pin_code or "",
                        property_type=rpt.property_type,
                        status=ListingStatus.AVAILABLE,
                        report_count=0,
                        vendor_count=0,
                        is_active=True,
                    )
                    db.add(listing_map[key])

                lst = listing_map[key]
                lst.report_count += 1
                if not lst.latest_report_date or (rpt.report_date and rpt.report_date > lst.latest_report_date):
                    lst.latest_report_date = rpt.report_date
                listing_report_entries.append((key, rpt))

        await db.flush()

        # Compute averaged coordinates per listing
        for key, lst in listing_map.items():
            related_reports = [rpt for (k, rpt) in listing_report_entries if k == key]
            coords = [(rpt.latitude, rpt.longitude) for rpt in related_reports if rpt.latitude and rpt.longitude]
            if coords:
                lst.latitude = sum(c[0] for c in coords) / len(coords)
                lst.longitude = sum(c[1] for c in coords) / len(coords)
```

Make sure the rest of the listing creation block (vendor_count tracking, ListingReport creation) is preserved as-is after this change.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_demo.py
git commit -m "feat(phase9): add geocoordinates to seed data with listing coordinate averaging"
```

---

## Task 3: Backend Map API Endpoints

**Files:**
- Modify: `backend/app/api/lender/listings.py`
- Create: `backend/app/api/vendor/map.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add lender map endpoint**

In `backend/app/api/lender/listings.py`, add this endpoint after the existing `browse_listings` function:

```python
@router.get("/map")
async def listings_map(
    city: str | None = Query(None),
    pin_code: str | None = Query(None),
    property_type: str | None = Query(None),
    report_category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    from app.services.listing_service import get_listings_map_data

    return await get_listings_map_data(
        db,
        city=city,
        pin_code=pin_code,
        property_type=property_type,
        report_category=report_category,
    )
```

- [ ] **Step 2: Create vendor map router**

Create `backend/app/api/vendor/map.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.enums import ReportStatus
from app.models.report import Report
from app.models.vendor import VendorUser
from app.models.user import User

router = APIRouter(prefix="/api/vendor/map", tags=["vendor-map"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    )
    vendor_id = result.scalar_one_or_none()
    if not vendor_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_id


@router.get("/")
async def vendor_map_data(
    city: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    # Own reports with coordinates
    own_query = select(Report).where(
        Report.vendor_id == vendor_id,
        Report.latitude.isnot(None),
        Report.longitude.isnot(None),
        Report.is_active == True,
    )
    if city:
        own_query = own_query.where(Report.city == city)
    own_result = await db.execute(own_query)
    own_reports = own_result.scalars().all()

    # Competitor areas — aggregate other vendors' published reports by pin_code
    comp_query = (
        select(
            Report.pin_code,
            Report.city,
            func.avg(Report.latitude).label("latitude"),
            func.avg(Report.longitude).label("longitude"),
            func.count(Report.id).label("report_count"),
        )
        .where(
            Report.vendor_id != vendor_id,
            Report.status == ReportStatus.PUBLISHED,
            Report.latitude.isnot(None),
            Report.longitude.isnot(None),
            Report.is_active == True,
        )
        .group_by(Report.pin_code, Report.city)
    )
    if city:
        comp_query = comp_query.where(Report.city == city)
    comp_result = await db.execute(comp_query)
    competitor_rows = comp_result.all()

    return {
        "own_reports": [
            {
                "report_id": str(r.id),
                "latitude": float(r.latitude),
                "longitude": float(r.longitude),
                "property_address": r.property_address,
                "city": r.city,
                "property_type": r.property_type.value if r.property_type else None,
                "report_category": r.report_category.value if r.report_category else None,
                "status": r.status.value if r.status else None,
                "report_date": r.report_date.isoformat() if r.report_date else None,
            }
            for r in own_reports
        ],
        "competitor_areas": [
            {
                "pin_code": row.pin_code,
                "city": row.city,
                "latitude": float(row.latitude),
                "longitude": float(row.longitude),
                "report_count": row.report_count,
            }
            for row in competitor_rows
        ],
    }
```

- [ ] **Step 3: Add listing map service function**

In `backend/app/services/listing_service.py`, add this function (at the end of the file):

```python
async def get_listings_map_data(
    db: AsyncSession,
    city: str | None = None,
    pin_code: str | None = None,
    property_type: str | None = None,
    report_category: str | None = None,
) -> dict:
    from app.models.enums import ListingStatus

    query = select(Listing).where(
        Listing.status == ListingStatus.AVAILABLE,
        Listing.report_count > 0,
        Listing.latitude.isnot(None),
        Listing.longitude.isnot(None),
    )

    if city:
        query = query.where(Listing.city == city)
    if pin_code:
        query = query.where(Listing.pin_code == pin_code)
    if property_type:
        query = query.where(Listing.property_type == property_type)
    if report_category:
        from app.models.listing import ListingReport

        query = query.where(
            Listing.id.in_(
                select(ListingReport.listing_id)
                .join(Report, Report.id == ListingReport.report_id)
                .where(Report.report_category == report_category)
            )
        )

    result = await db.execute(query)
    listings = result.scalars().all()

    return {
        "items": [
            {
                "listing_id": str(lst.id),
                "latitude": float(lst.latitude),
                "longitude": float(lst.longitude),
                "macro_location": lst.macro_location,
                "city": lst.city,
                "pin_code": lst.pin_code,
                "property_type": lst.property_type.value if lst.property_type else None,
                "report_count": lst.report_count,
                "vendor_count": lst.vendor_count,
                "latest_report_date": lst.latest_report_date.isoformat() if lst.latest_report_date else None,
            }
            for lst in listings
        ]
    }
```

Add `from app.models.report import Report` to the imports at the top of `listing_service.py` if not already present.

- [ ] **Step 4: Register vendor map router in main.py**

In `backend/app/main.py`, add the import:

```python
from app.api.vendor.map import router as vendor_map_router
```

And add the include:

```python
app.include_router(vendor_map_router)
```

- [ ] **Step 5: Verify server starts**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local restart backend
docker compose -f docker-compose.local.yml --env-file .env.local logs backend --tail=5
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/lender/listings.py backend/app/api/vendor/map.py backend/app/services/listing_service.py backend/app/main.py
git commit -m "feat(phase9): add lender listings map and vendor coverage map API endpoints"
```

---

## Task 4: Frontend Dependencies + TypeScript Types

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/types/map.ts`

- [ ] **Step 1: Install Leaflet packages**

```bash
cd /home/yogidigital/projects/propeval/frontend && npm install leaflet react-leaflet react-leaflet-markercluster @types/leaflet
```

- [ ] **Step 2: Create map TypeScript types**

Create `frontend/src/types/map.ts`:

```typescript
export interface ListingMapItem {
  listing_id: string;
  latitude: number;
  longitude: number;
  macro_location: string;
  city: string;
  pin_code: string;
  property_type: string;
  report_count: number;
  vendor_count: number;
  latest_report_date: string | null;
}

export interface ListingMapResponse {
  items: ListingMapItem[];
}

export interface VendorOwnReport {
  report_id: string;
  latitude: number;
  longitude: number;
  property_address: string;
  city: string;
  property_type: string | null;
  report_category: string | null;
  status: string | null;
  report_date: string | null;
}

export interface CompetitorArea {
  pin_code: string;
  city: string;
  latitude: number;
  longitude: number;
  report_count: number;
}

export interface VendorMapResponse {
  own_reports: VendorOwnReport[];
  competitor_areas: CompetitorArea[];
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/map.ts
git commit -m "feat(phase9): add Leaflet dependencies and map TypeScript types"
```

---

## Task 5: Map Wrapper Component (SSR-safe)

**Files:**
- Create: `frontend/src/components/map-wrapper.tsx`

- [ ] **Step 1: Create the dynamic map wrapper**

Create `frontend/src/components/map-wrapper.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

interface MapContainerProps {
  center: [number, number];
  zoom: number;
  className?: string;
  children?: ReactNode;
}

const LeafletMap = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { MapContainer, TileLayer } = mod;

      function Map({ center, zoom, className, children }: MapContainerProps) {
        return (
          <MapContainer
            center={center}
            zoom={zoom}
            className={className}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {children}
          </MapContainer>
        );
      }

      return Map;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <p className="text-gray-400 text-sm">Loading map…</p>
      </div>
    ),
  }
);

export { LeafletMap };
export type { MapContainerProps };

export function MapMarker({
  position,
  children,
  icon,
}: {
  position: [number, number];
  children?: ReactNode;
  icon?: L.Icon;
}) {
  // This component must be dynamically imported too
  return null;
}
```

Actually, since Leaflet components (Marker, Popup, etc.) also need SSR protection, the cleaner approach is to have the map pages themselves use dynamic import. Let me revise.

Create `frontend/src/components/map-wrapper.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export default function MapWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <p className="text-gray-400 text-sm">Loading map…</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

Also create a CSS import file. Add to `frontend/src/app/globals.css` (or the appropriate global CSS file):

```css
@import "leaflet/dist/leaflet.css";
```

Alternatively, import it in the map components directly:

```tsx
import "leaflet/dist/leaflet.css";
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/map-wrapper.tsx
git commit -m "feat(phase9): add SSR-safe map wrapper component"
```

---

## Task 6: Lender Listings Map Component

**Files:**
- Create: `frontend/src/app/lender/listings/_components/listings-map.tsx`

- [ ] **Step 1: Create the listings map component**

Create `frontend/src/app/lender/listings/_components/listings-map.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { ListingMapItem, ListingMapResponse } from "@/types/map";

const MapWithMarkers = dynamic(() => import("./listings-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
      <p className="text-gray-400 text-sm">Loading map…</p>
    </div>
  ),
});

interface ListingsMapProps {
  cityFilter: string;
  pinCodeFilter: string;
  propertyTypeFilter: string;
  reportCategoryFilter: string;
}

export default function ListingsMap({
  cityFilter,
  pinCodeFilter,
  propertyTypeFilter,
  reportCategoryFilter,
}: ListingsMapProps) {
  const [items, setItems] = useState<ListingMapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cityFilter) params.set("city", cityFilter);
        if (pinCodeFilter) params.set("pin_code", pinCodeFilter);
        if (propertyTypeFilter) params.set("property_type", propertyTypeFilter);
        if (reportCategoryFilter) params.set("report_category", reportCategoryFilter);
        const res = await api.get<ListingMapResponse>(`/api/lender/listings/map?${params}`);
        setItems(res.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, [cityFilter, pinCodeFilter, propertyTypeFilter, reportCategoryFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
        <p className="text-gray-400 text-sm">Loading map data…</p>
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 220px)" }} className="rounded-lg overflow-hidden border border-gray-200">
      <MapWithMarkers items={items} />
    </div>
  );
}
```

Then create `frontend/src/app/lender/listings/_components/listings-map-inner.tsx`:

```tsx
"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { ListingMapItem } from "@/types/map";

const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ items }: { items: ListingMapItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (items.length > 0) {
      const bounds = L.latLngBounds(items.map((i) => [i.latitude, i.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [items, map]);
  return null;
}

export default function ListingsMapInner({ items }: { items: ListingMapItem[] }) {
  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds items={items} />
      {items.map((item) => (
        <Marker
          key={item.listing_id}
          position={[item.latitude, item.longitude]}
          icon={defaultIcon}
        >
          <Popup>
            <div className="text-sm space-y-1 min-w-[180px]">
              <div className="font-semibold">{item.macro_location}</div>
              <div className="text-gray-500">{item.city} — {item.pin_code}</div>
              <div>
                <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                  {item.property_type}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {item.report_count} reports · {item.vendor_count} vendors
              </div>
              {item.latest_report_date && (
                <div className="text-xs text-gray-400">Latest: {item.latest_report_date}</div>
              )}
              <a
                href={`/lender/listings/${item.listing_id}`}
                className="text-xs text-blue-600 hover:underline block mt-1"
              >
                View Details →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/lender/listings/_components/listings-map.tsx frontend/src/app/lender/listings/_components/listings-map-inner.tsx
git commit -m "feat(phase9): add lender listings map component with markers and popups"
```

---

## Task 7: Lender Listings Page — Map/List Toggle

**Files:**
- Modify: `frontend/src/app/lender/listings/page.tsx`

- [ ] **Step 1: Add view toggle and conditional rendering**

Replace the full contents of `frontend/src/app/lender/listings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ListingBrowseResponse } from "@/types/listing";
import { ListingCard } from "./_components/listing-card";
import ListingsMap from "./_components/listings-map";

type ViewMode = "list" | "map";

export default function LenderListingsPage() {
  const [data, setData] = useState<ListingBrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [pinCodeFilter, setPinCodeFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [reportCategoryFilter, setReportCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    if (viewMode === "map") return;
    const fetchListings = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (cityFilter) params.set("city", cityFilter);
        if (pinCodeFilter) params.set("pin_code", pinCodeFilter);
        if (propertyTypeFilter) params.set("property_type", propertyTypeFilter);
        if (reportCategoryFilter) params.set("report_category", reportCategoryFilter);
        params.set("page", String(page));
        const res = await api.get<ListingBrowseResponse>(`/api/lender/listings/?${params}`);
        setData(res);
      } catch {
        setError("Failed to load listings");
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [page, cityFilter, pinCodeFilter, propertyTypeFilter, reportCategoryFilter, viewMode]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Listings Marketplace</h1>

        {/* View toggle */}
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 py-2 text-sm ${viewMode === "map" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            title="Map view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="City"
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-40"
        />
        <input
          type="text"
          placeholder="Pin Code"
          value={pinCodeFilter}
          onChange={(e) => { setPinCodeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-36"
        />
        <select
          value={propertyTypeFilter}
          onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-44"
        >
          <option value="">All Property Types</option>
          <option value="RESIDENTIAL">Residential</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="INDUSTRIAL">Industrial</option>
          <option value="AGRICULTURAL">Agricultural</option>
        </select>
        <select
          value={reportCategoryFilter}
          onChange={(e) => { setReportCategoryFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-44"
        >
          <option value="">All Report Types</option>
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      {/* Map view */}
      {viewMode === "map" && (
        <ListingsMap
          cityFilter={cityFilter}
          pinCodeFilter={pinCodeFilter}
          propertyTypeFilter={propertyTypeFilter}
          reportCategoryFilter={reportCategoryFilter}
        />
      )}

      {/* List view */}
      {viewMode === "list" && (
        <>
          {error && <p className="text-red-600 mb-4">{error}</p>}

          {loading ? (
            <p className="text-gray-500">Loading listings...</p>
          ) : data && data.listings.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>

              {data.total > data.page_size && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 border rounded text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-500">
                    Page {page} of {Math.ceil(data.total / data.page_size)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * data.page_size >= data.total}
                    className="px-3 py-2 border rounded text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500">No listings available matching your filters.</p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3020/lender/listings`, log in as lender. Confirm:
- List/map toggle buttons visible in top-right
- List view works as before
- Map view shows Leaflet map with markers for listings
- Click marker shows popup with listing details + "View Details" link
- Filters apply to both views

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/listings/page.tsx
git commit -m "feat(phase9): add map/list toggle to lender listings page"
```

---

## Task 8: Vendor Coverage Map Page

**Files:**
- Create: `frontend/src/app/vendor/map/page.tsx`
- Modify: `frontend/src/app/vendor/layout.tsx`

- [ ] **Step 1: Create the vendor map page**

Create `frontend/src/app/vendor/map/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { VendorMapResponse } from "@/types/map";

const VendorMapInner = dynamic(() => import("./_components/vendor-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
      <p className="text-gray-400 text-sm">Loading map…</p>
    </div>
  ),
});

export default function VendorMapPage() {
  const [data, setData] = useState<VendorMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cityFilter) params.set("city", cityFilter);
        const res = await api.get<VendorMapResponse>(`/api/vendor/map/?${params}`);
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [cityFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Coverage Map</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by city"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full sm:w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
          <p className="text-gray-400 text-sm">Loading map data…</p>
        </div>
      ) : data ? (
        <div className="relative" style={{ height: "calc(100vh - 220px)" }}>
          <div className="rounded-lg overflow-hidden border border-gray-200 h-full">
            <VendorMapInner ownReports={data.own_reports} competitorAreas={data.competitor_areas} />
          </div>
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 z-[1000] text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              Your Reports
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Other Vendors
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Failed to load map data.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the vendor map inner component**

Create `frontend/src/app/vendor/map/_components/vendor-map-inner.tsx`:

```tsx
"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { VendorOwnReport, CompetitorArea } from "@/types/map";

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ ownReports, competitorAreas }: { ownReports: VendorOwnReport[]; competitorAreas: CompetitorArea[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [
      ...ownReports.map((r) => [r.latitude, r.longitude] as [number, number]),
      ...competitorAreas.map((c) => [c.latitude, c.longitude] as [number, number]),
    ];
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [ownReports, competitorAreas, map]);
  return null;
}

export default function VendorMapInner({
  ownReports,
  competitorAreas,
}: {
  ownReports: VendorOwnReport[];
  competitorAreas: CompetitorArea[];
}) {
  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds ownReports={ownReports} competitorAreas={competitorAreas} />

      {/* Own reports — green markers */}
      {ownReports.map((report) => (
        <Marker
          key={report.report_id}
          position={[report.latitude, report.longitude]}
          icon={greenIcon}
        >
          <Popup>
            <div className="text-sm space-y-1 min-w-[180px]">
              <div className="font-semibold">{report.property_address}</div>
              <div className="text-gray-500">{report.city}</div>
              <div className="flex gap-1">
                {report.property_type && (
                  <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                    {report.property_type}
                  </span>
                )}
                {report.report_category && (
                  <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                    {report.report_category}
                  </span>
                )}
              </div>
              {report.status && (
                <div className="text-xs text-gray-600">Status: {report.status}</div>
              )}
              {report.report_date && (
                <div className="text-xs text-gray-400">{report.report_date}</div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Competitor areas — red circles with count */}
      {competitorAreas.map((area) => (
        <CircleMarker
          key={`${area.pin_code}-${area.city}`}
          center={[area.latitude, area.longitude]}
          radius={Math.min(12 + area.report_count * 3, 30)}
          pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.6 }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{area.report_count} reports by other vendors</div>
              <div className="text-gray-500">{area.pin_code}, {area.city}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 3: Add "Coverage Map" to vendor sidebar**

In `frontend/src/app/vendor/layout.tsx`, add the Coverage Map link after "My Listings" in both the desktop sidebar (line 21) and mobile drawer (line 51).

Desktop sidebar — after line 21 (`<a href="/vendor/listings" ...>My Listings</a>`):
```tsx
          <a href="/vendor/map" className="block px-2 py-3 rounded hover:bg-gray-100">Coverage Map</a>
```

Mobile drawer — after line 51 (`<a href="/vendor/listings" ...>My Listings</a>`):
```tsx
              <a href="/vendor/map" className="block px-2 py-3 rounded hover:bg-gray-100">Coverage Map</a>
```

- [ ] **Step 4: Verify in browser**

Log in as `vendor@valuepro.com`, navigate to `/vendor/map`. Confirm:
- City filter works
- Green markers for vendor's own reports
- Red circles for competitor areas with counts
- Legend in bottom-left corner
- Popups work for both marker types

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/vendor/map/ frontend/src/app/vendor/layout.tsx
git commit -m "feat(phase9): add vendor coverage map page with green/red markers"
```

---

## Task 9: Rebuild, Reseed, Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rebuild backend and reseed**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local build backend
docker compose -f docker-compose.local.yml --env-file .env.local exec postgres psql -U propeval -d propeval -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose -f docker-compose.local.yml --env-file .env.local up -d --force-recreate backend
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic upgrade head
docker compose -f docker-compose.local.yml --env-file .env.local exec backend python -m scripts.seed_demo
```

Install Leaflet in the frontend container:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec frontend npm install leaflet react-leaflet react-leaflet-markercluster @types/leaflet
docker compose -f docker-compose.local.yml --env-file .env.local restart frontend
```

- [ ] **Step 2: Update CLAUDE.md**

Add Phase 9 to the Current Status section after Phase 8:
```
**Phase 9 (Map Views):** Complete — Leaflet + React Leaflet map views, lender listings page map/list toggle with clustered markers, vendor coverage map (/vendor/map) with own reports (green) vs competitor density (red circles), listing model lat/lng with coordinate averaging, seed data with geocoordinates across 4 cities
```

Add to Key Files section:
```
- `backend/app/api/vendor/map.py` — Vendor coverage map endpoint (own reports + competitor areas)
- `frontend/src/app/vendor/map/page.tsx` — Vendor coverage map page
- `frontend/src/app/lender/listings/_components/listings-map.tsx` — Lender listings map component
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(phase9): update CLAUDE.md with Phase 9 completion status"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 1: Verify lender map API**

```bash
TOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login -H "Content-Type: application/json" -d '{"email":"lender@abcl.com","password":"lender123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8020/api/lender/listings/map -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
```

Expected: JSON with `items` array containing listing objects with lat/lng.

- [ ] **Step 2: Verify vendor map API**

```bash
TOKEN=$(curl -s -X POST http://localhost:8020/api/auth/login -H "Content-Type: application/json" -d '{"email":"vendor@valuepro.com","password":"vendor123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8020/api/vendor/map/ -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'Own reports: {len(d[\"own_reports\"])}')
print(f'Competitor areas: {len(d[\"competitor_areas\"])}')
"
```

Expected: Own reports with coordinates, competitor areas with counts per pin_code.

- [ ] **Step 3: Verify lender map in browser**

Navigate to `http://localhost:3020/lender/listings`. Confirm:
- Map/list toggle visible
- Click map icon → shows Leaflet map with markers
- Markers have popups with listing details
- Filters work in map view
- Switch back to list → grid view restored

- [ ] **Step 4: Verify vendor map in browser**

Navigate to `http://localhost:3020/vendor/map`. Confirm:
- Green markers for own reports
- Red circles for competitor areas with counts
- Legend visible
- City filter works
- Popups work for both types
