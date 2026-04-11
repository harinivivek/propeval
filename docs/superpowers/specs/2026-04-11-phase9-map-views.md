# Phase 9: Map Views — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Interactive map views for lenders (listing browse) and vendors (coverage analysis with competitor data)

---

## 1. Overview

Add interactive map views to the PropEval platform using Leaflet + React Leaflet. Lenders get a map/list toggle on their existing listings browse page. Vendors get a dedicated coverage map page showing their reports (green) alongside competitor report density (red). Seed data is updated with realistic geocoordinates for all 4 cities.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Geocoding approach | Manual seed coordinates only | Gets maps working immediately; geocoding service is separate concern |
| Competitor view | Full (own green + competitor red counts) | Core value prop for vendors — "where are the gaps?" |
| Lender map location | Toggle on existing listings page | Reuses filters, avoids duplicating listing logic |
| Vendor map location | Standalone `/vendor/map` page | Different purpose than listings — coverage analysis tool |
| Map library | Leaflet + React Leaflet | Free, no API key, lightweight, sufficient for pins + popups |

---

## 2. Data Model Changes

### Listing Model — Add Coordinates

Add to existing `Listing` model (`backend/app/models/listing.py`):

| Column | Type | Notes |
|--------|------|-------|
| `latitude` | Decimal(10, 7), nullable | Average of constituent reports' latitudes |
| `longitude` | Decimal(10, 7), nullable | Average of constituent reports' longitudes |

Coordinates are computed as the average of all linked reports' lat/lng when reports are added to a listing. Updated via the listing service when listings are created or modified.

### Seed Data — Geocoordinates

Add realistic lat/lng to all 31 seeded reports in `seed_demo.py`:

| City | Neighborhoods | Lat Range | Lng Range |
|------|--------------|-----------|-----------|
| Bengaluru | Koramangala, Indiranagar, Jayanagar, HSR Layout | 12.93–12.97 | 77.58–77.65 |
| Mumbai | Andheri, Bandra, Powai | 19.05–19.12 | 72.83–72.91 |
| Delhi | Dwarka, Rohini, Saket | 28.52–28.72 | 77.03–77.22 |
| Chennai | T Nagar, Adyar, Anna Nagar | 13.03–13.09 | 80.20–80.25 |

---

## 3. Backend API

### Lender Map Endpoint

`GET /api/lender/listings/map`

Auth: `require_role("LENDER")`

Query params (same as browse): `city`, `pin_code`, `property_type`, `report_category`

Response (no pagination — all matching listings):
```json
{
  "items": [
    {
      "listing_id": "uuid",
      "latitude": 12.9352,
      "longitude": 77.6245,
      "macro_location": "Koramangala",
      "city": "Bengaluru",
      "pin_code": "560034",
      "property_type": "RESIDENTIAL",
      "report_count": 3,
      "vendor_count": 2,
      "latest_report_date": "2026-04-01"
    }
  ]
}
```

Only returns listings that have non-null latitude/longitude.

### Vendor Map Endpoint

`GET /api/vendor/map`

Auth: `require_role("VENDOR")`

Query params: `city` (optional filter)

Response:
```json
{
  "own_reports": [
    {
      "report_id": "uuid",
      "latitude": 12.9352,
      "longitude": 77.6245,
      "property_address": "123 MG Road, Koramangala",
      "city": "Bengaluru",
      "property_type": "RESIDENTIAL",
      "report_category": "VALUATION",
      "status": "PUBLISHED",
      "report_date": "2026-04-01"
    }
  ],
  "competitor_areas": [
    {
      "pin_code": "560034",
      "city": "Bengaluru",
      "latitude": 12.9340,
      "longitude": 77.6250,
      "report_count": 5
    }
  ]
}
```

- `own_reports`: All of the authenticated vendor's reports with non-null coordinates
- `competitor_areas`: Aggregated by pin_code — average lat/lng and count of other vendors' published reports per pin_code. Includes all pin_code areas where other vendors have published reports, regardless of whether this vendor also has reports there. The vendor sees the overlap visually via green + red markers in the same area.

---

## 4. Frontend — Lender Map View

### Toggle on Listings Page

Add map/list toggle buttons to the existing filter bar on `/lender/listings`:
- Two icon buttons: grid icon (list view) and map-pin icon (map view)
- Active view has highlighted/filled icon
- Filters apply to both views — switching preserves filter state
- Default view: list (current behavior)

### Map Component

- Full-width Leaflet map below the filter bar, taking remaining viewport height (`calc(100vh - filter bar height)`)
- OpenStreetMap tiles
- Default center: India (20.5937, 78.9629, zoom 5)
- Auto-fits bounds to visible markers when data loads or filters change

### Markers & Interaction

- Blue markers for each listing at its aggregated coordinates
- Marker clustering via `react-leaflet-markercluster` — nearby listings group into cluster circles showing count
- Click cluster → zooms in to show individual markers
- Click marker → popup showing:
  - Macro location, city, pin code
  - Property type badge
  - Report count, vendor count
  - Latest report date
  - "View Details" link → `/lender/listings/{id}`

### Responsive

- Desktop: map takes full content area
- Mobile: map takes ~60vh height

---

## 5. Frontend — Vendor Map View

### New Page: `/vendor/map`

Standalone page added to vendor sidebar navigation as "Coverage Map" with map-pin icon.

### Layout

- Filter bar at top: city dropdown
- Full-width Leaflet map taking remaining viewport height
- Legend overlay in bottom-left: green circle = "Your Reports", red circle = "Other Vendors"

### Markers

**Own reports (green markers):**
- Individual green markers for each of the vendor's reports with coordinates
- Click → popup: property address, property type, category, status, report date

**Competitor areas (red circle markers):**
- One red circle marker per pin_code area
- Circle displays the report count number inside
- Click → popup: "{count} reports by other vendors in {pin_code}, {city}"
- No drill-down into individual competitor reports

### Gap Identification

The visual contrast between green (yours) and red (others) makes gaps obvious — areas with red markers but no nearby green markers represent opportunities. No special recommendation engine or gap-detection algorithm needed.

### Responsive

- Desktop: full content area map
- Mobile: map takes ~60vh, legend overlaid bottom-left

---

## 6. Dependencies

### Frontend

| Package | Purpose |
|---------|---------|
| `leaflet` | Core map library |
| `react-leaflet` | React wrapper |
| `react-leaflet-markercluster` | Marker clustering for lender map |
| `@types/leaflet` | TypeScript types |

### Leaflet Integration Notes

- Leaflet CSS must be imported (required for tiles/markers to render)
- Map components must use Next.js dynamic import with `ssr: false` — Leaflet accesses `window` which isn't available during server-side rendering
- Custom marker icons for green/red vendor markers (Leaflet's default markers are blue)

### Backend

No new dependencies. Existing SQLAlchemy aggregation functions sufficient for coordinate averaging and competitor counting.

---

## 7. Listing Service Changes

Update `_create_or_update_listing()` in `listing_service.py` to compute and store averaged coordinates:

When a report is added to a listing, recalculate the listing's lat/lng as the average of all constituent reports' coordinates (only those with non-null lat/lng).

---

## 8. Navigation Changes

### Vendor Sidebar

Add "Coverage Map" link to vendor sidebar navigation:
- Icon: map-pin (from lucide-react)
- Path: `/vendor/map`
- Position: after "Listings" in the sidebar

### Lender Listings Page

No sidebar change — the map toggle is inline on the existing page.

---

## 9. Out of Scope

- Geocoding service (coordinates entered manually or via OCR extraction)
- Map on admin dashboard
- Route or distance calculations
- Offline map support
- Heatmaps or density visualization
- Radius-based search
- Real-time updates
- "Suggest areas" recommendation engine
- Map on vendor dashboard (separate standalone page instead)
