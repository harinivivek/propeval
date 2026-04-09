# Phase 2: Pricing & Report Models — Design Spec

**Date:** 2026-04-09
**Goal:** Full data layer for reports, listings, requests, pricing, and billing. Pricing service with admin CRUD UI.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Admin UI scope | Models + service + basic admin CRUD UI | Lets us seed/test pricing immediately for Phase 3 |
| Pricing structure | Single table with variant columns | 4 fixed variants, avoids unnecessary joins |
| Area granularity | City + optional area with fallback | Matches ServiceArea model, optional granularity |
| Report schema | Full schema now | Fields are well-defined, avoids migration churn |
| File organization | One model file per domain | Follows Phase 1 convention, stays readable |

---

## 1. New Enums (`models/enums.py`)

All existing enums remain unchanged. Add:

```python
class EarningType(str, Enum):
    REQUEST = "REQUEST"
    LISTING_DOWNLOAD = "LISTING_DOWNLOAD"

class PayableType(str, Enum):
    NEW_REQUEST = "NEW_REQUEST"
    LISTING_DOWNLOAD = "LISTING_DOWNLOAD"
    UPDATE = "UPDATE"
    NEARBY = "NEARBY"

class InvoiceType(str, Enum):
    PAYABLE = "PAYABLE"
    RECEIVABLE = "RECEIVABLE"

class BroadcastStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    ACCEPTED = "ACCEPTED"
```

---

## 2. Data Models

All models inherit from `BaseModel` (UUID PK + created_at/updated_at).

### 2.1 PricingRule (`models/pricing.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK (from BaseModel) |
| `lender_id` | UUID FK -> Lender | Required |
| `report_category` | ReportCategory enum | VALUATION or LEGAL |
| `city` | String | Required |
| `area` | String | Nullable -- falls back to city-level if NULL |
| `property_type` | PropertyType enum | Required |
| `new_request_price` | Numeric(10,2) | Workflow 1 price |
| `listing_download_price` | Numeric(10,2) | Workflow 2.1 price |
| `update_additional_price` | Numeric(10,2) | Workflow 2.2 additional |
| `nearby_additional_price` | Numeric(10,2) | Workflow 2.3 additional |
| `is_active` | Boolean | Default true |

**Unique constraint:** `(lender_id, report_category, city, area, property_type)` — implemented as a partial unique index to handle NULL area correctly. Two indexes: one for rows where area IS NOT NULL, one for rows where area IS NULL (excluding area from the index columns).

### 2.2 Report (`models/report.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `vendor_id` | UUID FK -> Vendor | Who created it |
| `report_category` | ReportCategory | VALUATION or LEGAL |
| `status` | ReportStatus | UPLOADED -> PROCESSING -> READY_TO_PUBLISH -> PUBLISHED -> ARCHIVED |
| `property_address` | String | Full micro-address (vendor-visible only) |
| `macro_location` | String | Area/locality for listing grouping |
| `city` | String | |
| `pin_code` | String | Nullable |
| `property_type` | PropertyType | |
| `plot_extent_sqft` | Numeric(12,2) | Nullable |
| `built_up_sqft` | Numeric(12,2) | Nullable |
| `valuation_amount` | Numeric(14,2) | Nullable (valuation reports) |
| `loan_applicant_name` | String | PII -- redacted in listings |
| `report_date` | Date | When report was created |
| `expiry_date` | Date | Nullable |
| `content_json` | JSONB | OCR-extracted structured data (Phase 4) |
| `uploaded_file_path` | String | Path to PDF |
| `latitude` | Numeric(10,7) | Nullable |
| `longitude` | Numeric(10,7) | Nullable |
| `listing_approved` | Boolean | Default false -- vendor must approve for listing |
| `is_active` | Boolean | Default true |

### 2.3 ReportRevision (`models/report.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `report_id` | UUID FK -> Report | |
| `revision_number` | Integer | Sequential |
| `changes_json` | JSONB | What changed |
| `comments` | Text | Lender's revision comments |

### 2.4 Listing (`models/listing.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `macro_location` | String | Grouping key |
| `city` | String | |
| `property_type` | PropertyType | |
| `status` | ListingStatus | DRAFT / AVAILABLE / ARCHIVED |
| `report_count` | Integer | Denormalized count |
| `latest_report_date` | Date | For sorting |
| `is_active` | Boolean | Default true |

### 2.5 ListingReport (`models/listing.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `listing_id` | UUID FK -> Listing | |
| `report_id` | UUID FK -> Report | Unique (one report, one listing) |
| `display_order` | Integer | For priority ordering |

### 2.6 ReportRequest (`models/request.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `lender_id` | UUID FK -> Lender | |
| `lender_user_id` | UUID FK -> User | Who raised it |
| `branch_id` | UUID FK -> LenderBranch | Nullable |
| `request_type` | RequestType | NEW / UPDATE / NEARBY |
| `report_category` | ReportCategory | VALUATION or LEGAL |
| `num_reports_needed` | Integer | Default 1 |
| `property_address` | String | |
| `property_type` | PropertyType | |
| `plot_extent_sqft` | Numeric(12,2) | Nullable |
| `loan_applicant_name` | String | |
| `city` | String | |
| `area` | String | Nullable |
| `eta_days` | Integer | Expected turnaround |
| `price` | Numeric(10,2) | Calculated price at time of request |
| `vendor_specified_id` | UUID FK -> Vendor | Nullable |
| `allow_broadcast_on_reject` | Boolean | Default true |
| `parent_report_id` | UUID FK -> Report | Nullable -- for UPDATE/NEARBY |
| `comments` | Text | Nullable |
| `lender_status` | LenderRequestStatus | |
| `vendor_status` | VendorRequestStatus | Nullable (set when vendor assigned) |

### 2.7 RequestBroadcast (`models/request.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `request_id` | UUID FK -> ReportRequest | |
| `vendor_ids` | ARRAY(UUID) | Vendors in this round |
| `broadcast_round` | Integer | Round number |
| `accept_deadline` | DateTime(tz) | When this round expires |
| `status` | BroadcastStatus | ACTIVE / EXPIRED / ACCEPTED |

### 2.8 RequestAcceptance (`models/request.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `request_id` | UUID FK -> ReportRequest | |
| `vendor_id` | UUID FK -> Vendor | |
| `accepted_at` | DateTime(tz) | |
| `report_id` | UUID FK -> Report | Nullable -- filled when report submitted |

### 2.9 VendorEarning (`models/billing.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `vendor_id` | UUID FK -> Vendor | |
| `report_id` | UUID FK -> Report | |
| `request_id` | UUID FK -> ReportRequest | Nullable |
| `lender_id` | UUID FK -> Lender | Who paid |
| `amount` | Numeric(10,2) | |
| `earning_type` | EarningType | REQUEST / LISTING_DOWNLOAD |
| `month` | String | "2026-04" format for grouping |

### 2.10 LenderPayable (`models/billing.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `lender_id` | UUID FK -> Lender | |
| `report_id` | UUID FK -> Report | |
| `request_id` | UUID FK -> ReportRequest | Nullable |
| `amount` | Numeric(10,2) | |
| `payable_type` | PayableType | NEW_REQUEST / LISTING_DOWNLOAD / UPDATE / NEARBY |
| `status` | PaymentStatus | PENDING / BILLED / PAID |
| `month` | String | |

### 2.11 Invoice (`models/billing.py`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `invoice_type` | InvoiceType | PAYABLE / RECEIVABLE |
| `organization_id` | UUID FK -> Organization | |
| `amount` | Numeric(10,2) | |
| `status` | PaymentStatus | |
| `month` | String | |
| `generated_at` | DateTime(tz) | Nullable |

---

## 3. Pricing Service (`services/pricing_service.py`)

### `get_price(lender_id, report_category, city, area, property_type, request_type) -> Decimal`

Lookup logic:
1. Try exact match: `(lender_id, report_category, city, area, property_type)` where `is_active=True`
2. If no match and area is not None: fallback to `(lender_id, report_category, city, area=NULL, property_type)`
3. If still no match: raise `PricingNotFoundError`

Returns the appropriate price column based on `request_type`:
- NEW -> `new_request_price`
- LISTING_DOWNLOAD -> `listing_download_price`
- UPDATE -> `update_additional_price`
- NEARBY -> `nearby_additional_price`

### `get_pricing_rules(lender_id, filters?) -> list[PricingRule]`

Returns all active rules for a lender, optionally filtered by city/report_category/property_type.

### `create_pricing_rule(data) -> PricingRule`

Creates a new rule. Raises error on duplicate unique constraint violation.

### `update_pricing_rule(id, data) -> PricingRule`

Partial update of price fields and/or scope fields.

### `delete_pricing_rule(id) -> None`

Soft delete: sets `is_active=False`.

---

## 4. Admin Pricing API (`api/admin/pricing.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/pricing/rules?lender_id=` | List rules for a lender (required filter) |
| POST | `/api/admin/pricing/rules` | Create a pricing rule |
| PUT | `/api/admin/pricing/rules/{id}` | Update a pricing rule |
| DELETE | `/api/admin/pricing/rules/{id}` | Soft-delete a rule |
| GET | `/api/admin/pricing/calculate` | Preview price calculation (for testing) |

All endpoints require `GTR_ADMIN` role via `require_role()`.

---

## 5. Admin Pricing UI (`frontend/src/app/admin/pricing/`)

Simple functional page:

1. **Lender selector dropdown** at top -- required before anything shows
2. **Pricing rules table** -- columns: City, Area (or "All"), Property Type, Report Category, New Price, Download Price, Update Price, Nearby Price, Actions (Edit/Delete)
3. **"Add Rule" button** -- opens form/dialog:
   - City (text input)
   - Area (optional text input, placeholder: "Leave blank for city-wide pricing")
   - Property Type (dropdown)
   - Report Category (dropdown: Valuation / Legal)
   - Four price fields (number inputs)
4. **Edit** -- same form pre-filled
5. **Table filters** -- by city, property type, report category

No bulk import/export. No pricing preview in UI.

---

## 6. Schemas

### `schemas/pricing.py`

- `PricingRuleCreate` -- all fields except id/timestamps, lender_id required
- `PricingRuleUpdate` -- all price fields optional for partial updates
- `PricingRuleResponse` -- full model with lender name joined
- `PriceCalculationRequest` -- lender_id, report_category, city, area, property_type, request_type
- `PriceCalculationResponse` -- amount, rule_id, matched_area (shows if fallback was used)

### `schemas/report.py`

- `ReportCreate` -- vendor_id, report_category, property fields, file path
- `ReportResponse` -- full model fields
- `ReportBrief` -- id, report_category, city, macro_location, property_type, status, report_date

### `schemas/listing.py`

- `ListingResponse` -- full listing with report count, latest date
- `ListingBrief` -- id, macro_location, city, property_type, report_count, latest_report_date

### `schemas/request.py`

- `ReportRequestCreate` -- property details, request_type, report_category, vendor_specified_id, etc.
- `ReportRequestResponse` -- full request fields

### `schemas/billing.py`

- `VendorEarningResponse` -- read-only
- `LenderPayableResponse` -- read-only
- `InvoiceResponse` -- read-only

---

## 7. Migration

Single Alembic migration for all Phase 2 tables. Creation order (respecting FK dependencies):

1. `pricing_rules`
2. `reports`
3. `report_revisions`
4. `listings`
5. `listing_reports`
6. `report_requests`
7. `request_broadcasts`
8. `request_acceptances`
9. `vendor_earnings`
10. `lender_payables`
11. `invoices`

Command: `make migration msg="add phase 2 pricing report listing request billing models"`

---

## 8. Model Registration (`models/__init__.py`)

```python
from app.models.pricing import PricingRule
from app.models.report import Report, ReportRevision
from app.models.listing import Listing, ListingReport
from app.models.request import ReportRequest, RequestBroadcast, RequestAcceptance
from app.models.billing import VendorEarning, LenderPayable, Invoice
```

---

## 9. Seed Data

Extend `scripts/seed.py` to add sample pricing rules for the test lender (abcl):

| City | Property Type | Report Category | New | Download | Update | Nearby |
|------|--------------|-----------------|-----|----------|--------|--------|
| Mumbai | Residential | Valuation | 2500 | 1500 | 1000 | 1000 |
| Mumbai | Commercial | Valuation | 5000 | 3000 | 2000 | 2000 |
| Mumbai | Residential | Legal | 2000 | 1200 | 800 | 800 |
| Delhi | Residential | Valuation | 2800 | 1800 | 1200 | 1200 |

---

## 10. Scope Boundary

### In Phase 2

- 11 models (5 files) + migration
- 4 new enums
- Pricing service (CRUD + price calculation with area fallback)
- Admin pricing API (5 endpoints)
- Admin pricing UI (table + form page)
- Schemas for all models (basic create/response)
- Seed pricing data
- Register all models in `__init__.py`
- Register pricing router in `main.py`

### Out (later phases)

- Request workflow logic (Phase 3)
- Broadcast service (Phase 3)
- Report upload/OCR (Phase 3-4)
- Listing grouping service (Phase 5)
- Billing generation jobs (Phase 12)
- Dashboard analytics (Phase 7)
- WebSocket notifications (Phase 10)
