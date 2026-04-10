# Phase 5: Listings Marketplace — Design Spec

**Date:** 2026-04-10
**Phase:** 5 of 12
**Goal:** Lenders can browse, filter, and purchase reports from a listings marketplace. Vendors manage which published reports appear on the marketplace.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Macro-location grouping | System-derived from pin code + property type | Consistent, removes vendor subjectivity |
| Report → listing timing | Vendor manages separately from publishing | List/delist is a distinct action from publish |
| Lender preview depth | Rich preview with PII redaction | Enough info for informed purchase, sensitive fields gated |
| Purchase flow | Always instant access, no vendor approval | Simple and fast for lenders |
| Purchase granularity | Individual reports within a listing | Maximum flexibility for lenders |
| Access expiry | Permanent, no expiry | Simple to implement and reason about |
| Vendor UI | Toggle on report detail + dedicated listings page | Quick actions and birds-eye view |
| Analytics | Deferred to Phase 7 | Keep Phase 5 focused on marketplace mechanics |
| Architecture | Materialized Listing entities (not virtual groupings) | Models already exist; supports Phase 6 (update/nearby) and Phase 9 (map views) |

---

## 1. Data Model Changes

### 1.1 Listing Model — New Fields

The existing `Listing` model (`backend/app/models/listing.py`) gains:

- `pin_code` (String, not null) — grouping key alongside `property_type`
- `vendor_count` (Integer, default 0) — distinct vendors with reports in this listing
- Unique constraint on `(pin_code, property_type)` — one listing per combination

Existing fields remain unchanged: `macro_location`, `city`, `property_type`, `status`, `report_count`, `latest_report_date`, `is_active`.

### 1.2 New Model — ReportPurchase

Tracks which lenders have purchased which reports:

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `report_id` | FK → reports | |
| `listing_id` | FK → listings | |
| `lender_id` | FK → organizations | The lender org |
| `purchased_by` | FK → users | The specific user who purchased |
| `price` | Decimal | Price at time of purchase |
| `created_at` | timestamp | |

- Unique constraint on `(report_id, lender_id)` — a lender org can only buy a report once
- Serves access control ("has this lender bought this report?")
- Billing entries (VendorEarning, LenderPayable) are created alongside for the financial ledger

### 1.3 Report Model — No Changes

The existing `listing_approved` boolean on Report becomes the vendor's list/delist toggle.

---

## 2. Listing Service

New file: `backend/app/services/listing_service.py`

### 2.1 Listing Management (Vendor Actions)

**`list_report(db, report_id, vendor_id)`**
- Validates: report is PUBLISHED and belongs to vendor
- Looks up or creates a Listing by report's `pin_code + property_type`
- Derives `macro_location` from report's address locality, `city` from report
- Creates `ListingReport` join row
- Updates listing metadata: `report_count`, `latest_report_date`, `vendor_count`
- Sets `report.listing_approved = True`

**`delist_report(db, report_id, vendor_id)`**
- Removes the `ListingReport` join row
- Updates listing metadata
- If listing has zero reports remaining → status = ARCHIVED
- Sets `report.listing_approved = False`

### 2.2 Lender-Facing Queries

**`get_listings(db, filters, pagination)`**
- Returns paginated listings filtered by: city, pin_code, property_type
- Optional `report_category` filter: when set, only returns listings that contain at least one report of that category
- Ordered by `latest_report_date` descending (newest first)
- Only returns AVAILABLE listings with at least one report

**`get_listing_detail(db, listing_id, lender_id)`**
- Returns listing with its reports (PII-redacted, see Section 3)
- Flags which reports the lender has already purchased

### 2.3 Purchase

**`purchase_report(db, report_id, listing_id, lender_id, user_id)`**
- Validates: report is in the listing, lender hasn't already purchased it
- Calculates price via `pricing_service` using LISTING_DOWNLOAD variant
- Creates `ReportPurchase` record
- Calls `billing_service` to create VendorEarning + LenderPayable entries
- Returns the purchase record

**`get_purchased_reports(db, lender_id, filters, pagination)`**
- Returns all reports the lender org has purchased
- Full (non-redacted) details with download access

### 2.4 Vendor-Facing Queries

**`get_vendor_listings(db, vendor_id, filters, pagination)`**
- Returns listings containing at least one report from this vendor
- Vendor's own reports shown with full details (no PII redaction)

**`get_listable_reports(db, vendor_id)`**
- Returns vendor's PUBLISHED reports that are not yet listed

---

## 3. PII Redaction

Redaction happens at the service layer when preparing listing data for lenders. Vendors always see their own data unredacted.

### 3.1 Redaction Rules

| Field | Rule |
|-------|------|
| `property_address` | Drop first comma-separated segment (house/street), keep locality + city. Single-segment addresses → show city only |
| `loan_applicant_name` | Completely hidden |
| `valuation_amount` | Completely hidden |
| `plot_extent_sqft` | Rounded to nearest 100 |
| `built_up_sqft` | Rounded to nearest 100 |
| `latitude` / `longitude` | Rounded to 2 decimal places (~1.1 km precision) |

### 3.2 Fields Shown As-Is

- `property_type`, `report_category`, `report_date`, `city`, `pin_code`
- Extracted `content_json` fields: construction type, property description, number of floors, land use zone, boundary details
- Anything not personally identifiable or financially sensitive

### 3.3 Implementation

A `redact_report_for_listing(report)` utility function in the listing service that applies the rules above and returns a redacted Pydantic schema. After purchase, lenders get the full unredacted data plus file download access.

---

## 4. API Endpoints

### 4.1 Vendor Listings — `/api/vendor/listings/`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Vendor's listings (grouped view of listed reports) |
| GET | `/listable-reports` | Vendor's published but unlisted reports |
| POST | `/reports/{report_id}/list` | List a report on the marketplace |
| POST | `/reports/{report_id}/delist` | Remove a report from the marketplace |

Auth: `require_role(VendorRole)`. Ownership validated — only the report's vendor can list/delist.

### 4.2 Lender Listings — `/api/lender/listings/`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Browse listings with filters + pagination |
| GET | `/{listing_id}` | Listing detail with redacted report previews |
| POST | `/{listing_id}/reports/{report_id}/purchase` | Purchase a report |
| GET | `/purchases` | Lender's purchased reports (full details) |
| GET | `/purchases/{purchase_id}/download` | Download purchased report PDF |

Auth: `require_role(LenderRole)`. Purchase scoped to lender org. Download validates ReportPurchase exists.

Query parameters for listing browse:
- `city` (string, optional)
- `pin_code` (string, optional)
- `property_type` (PropertyType enum, optional)
- `report_category` (ReportCategory enum, optional)
- `page` (int, default 1)
- `page_size` (int, default 20)

---

## 5. Frontend Pages

### 5.1 Lender — Listings Browse (`/lender/listings/`)

Marketplace landing page. Filter bar at top: dropdowns for city, property type, report category, plus pin code text input. Below, a grid of listing cards. Each card shows:
- Macro-location name, city, pin code
- Property type badge
- Report count, vendor count
- Age of newest report (e.g., "2 days ago")

Sorted by newest report first. Paginated. Mobile: single-column card stack.

### 5.2 Lender — Listing Detail (`/lender/listings/[id]`)

Listing header: macro-location, city, pin code, property type.

Report cards within the listing, each showing:
- Redacted locality (truncated address)
- Property type, report category, report date
- Rounded area figures
- Extracted content_json snippets (construction type, floors, etc.)

Purchase state per report:
- Already purchased → "Purchased" badge + download button
- Not purchased → "Buy for ₹X" button → confirmation dialog → purchase → button becomes download

### 5.3 Lender — Purchased Reports (`/lender/listings/purchases`)

Table/card list of all purchased reports. Columns: property locality, city, property type, report category, purchase date, price paid, download button. Filterable and paginated. Mobile: card layout.

### 5.4 Vendor — My Listings (`/vendor/listings/`)

Listed reports grouped by listing (pin code + property type). Each group is expandable, showing individual reports: full address, report category, report date, listing status, "Delist" button.

Top CTA: "You have N unlisted reports" with link to bulk-list or navigate. Filterable by city, property type.

### 5.5 Vendor — Report Detail Modification

On the existing vendor report detail page, add a "Marketplace" section:
- Toggle switch: "Listed on marketplace" (enabled only when status = PUBLISHED)
- When listed, shows which listing the report belongs to (with link)

### 5.6 Responsive Design

Same patterns as existing pages:
- Card-based lists on mobile (< md), full tables on desktop
- Sidebar collapses on mobile
- Touch-friendly buttons (44px minimum targets)

---

## 6. Billing Integration

### 6.1 Pricing

Uses existing `pricing_service.calculate_price()` with the LISTING_DOWNLOAD variant. Looks up PricingRule by lender org + city + property type + optional area.

### 6.2 Purchase Billing Flow

1. Lender clicks "Buy" → frontend calls purchase endpoint
2. Service calls `pricing_service.calculate_price()` for listing download price
3. Creates `ReportPurchase` record with resolved price
4. Calls new `billing_service.create_listing_purchase_entries()`:
   - `VendorEarning` with `earning_type = LISTING_DOWNLOAD`
   - `LenderPayable` with `payable_type = LISTING_DOWNLOAD`
5. Returns purchase record → frontend shows success, enables download

### 6.3 Edge Cases

| Case | Behavior |
|------|----------|
| No pricing rule configured | 400 error. Frontend hides buy button, shows "Pricing not configured — contact admin" |
| Duplicate purchase | Unique constraint prevents at DB level. Service checks first, returns 409 |
| Report delisted after preview | Purchase returns 404. Previously purchased reports remain accessible regardless |

---

## 7. Navigation Integration

### 7.1 Lender Sidebar

Add "Listings" menu item (marketplace icon) linking to `/lender/listings/`. Add "Purchased Reports" as a sub-item or separate entry linking to `/lender/listings/purchases`.

### 7.2 Vendor Sidebar

Add "My Listings" menu item linking to `/vendor/listings/`.

---

## 8. Out of Scope (Deferred)

- **Listing analytics / download counters** — Phase 7
- **Update request from listing** — Phase 6 (Workflow 2.2)
- **Nearby request from listing** — Phase 6 (Workflow 2.3)
- **Vendor approval for downloads** — Decided against; always instant
- **Admin listing management** — Not needed for MVP
- **Map views of listings** — Phase 9
- **Listing search by keyword** — Not in scope; filter-based browsing only
