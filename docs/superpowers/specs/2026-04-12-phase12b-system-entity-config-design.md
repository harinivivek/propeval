# Phase 12B: System & Entity Configuration — Design Spec

**Date:** 2026-04-12
**Phase:** 12B of 12 (A: Billing & Invoicing [complete], B: System & Entity Config, C: Polish & Hardening)
**Scope:** Admin system config, vendor entity config, lender entity config, workflow wiring

---

## 1. Overview

Phase 12B makes the platform configurable at three levels:

1. **System-level** — Admin controls broadcast parameters, acceptance rules, and upload/validation settings via a UI instead of hardcoded constants.
2. **Vendor-level** — Vendors configure auto-listing, price thresholds, and lender exclusions from their settings page.
3. **Lender-level** — Lenders configure auto-approve preferences per vendor from their settings page.

All configuration is DB-stored with Redis caching for system config (60s TTL). Changes take effect on the next request/operation — no restart required.

---

## 2. Data Models

### 2.1 SystemConfig

Single-row table holding global platform parameters. Lazy-created with defaults on first access.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID PK | auto | BaseModel |
| vendors_per_broadcast_round | Integer | 5 | Vendors contacted per broadcast round |
| broadcast_accept_window_minutes | Integer | 30 | Minutes vendors have to accept a broadcast |
| auto_accept_days | Integer | 7 | Days before auto-accept triggers |
| max_upload_size_mb | Integer | 20 | Max file upload size in MB |
| required_report_fields | ARRAY(String) | see constants.py | Fields required before report publish |
| updated_by | UUID FK(User), nullable | null | Last admin who modified config |
| created_at / updated_at | DateTime | auto | BaseModel timestamps |

**Caching:** Redis key `system_config`, JSON-serialized, 60-second TTL. Invalidated on PUT.

### 2.2 VendorConfig

One-to-one with Vendor. Lazy-created with defaults on first GET.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID PK | auto | BaseModel |
| vendor_id | UUID FK(Vendor), unique | required | Owning vendor |
| auto_listing_enabled | Boolean | false | Auto-list accepted reports to marketplace |
| price_threshold | Numeric(12,2), nullable | null | Min acceptable price (null = accept all) |
| separate_valuation_legal | Boolean | false | Flag for future valuation vs legal differentiation |
| created_at / updated_at | DateTime | auto | BaseModel timestamps |

### 2.3 LenderConfig

One-to-one with Lender. Lazy-created with defaults on first GET. Currently a thin holder — auto-approve lives in the mapping table.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID PK | auto | BaseModel |
| lender_id | UUID FK(Lender), unique | required | Owning lender |
| created_at / updated_at | DateTime | auto | BaseModel timestamps |

### 2.4 LenderVendorPreference

Mapping table for per-vendor preferences from lender side.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID PK | auto | BaseModel |
| lender_id | UUID FK(Lender) | required | |
| vendor_id | UUID FK(Vendor) | required | |
| auto_approve | Boolean | false | Auto-accept reports from this vendor |
| created_at / updated_at | DateTime | auto | BaseModel timestamps |

**Constraint:** Unique on `(lender_id, vendor_id)`.

### 2.5 VendorLenderExclusion

Mapping table for vendor-side lender exclusions (listings visibility only).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | UUID PK | auto | BaseModel |
| vendor_id | UUID FK(Vendor) | required | |
| lender_id | UUID FK(Lender) | required | Excluded from seeing this vendor's listings |
| created_at / updated_at | DateTime | auto | BaseModel timestamps |

**Constraint:** Unique on `(vendor_id, lender_id)`.

---

## 3. Backend Services

### 3.1 System Config Service (`services/system_config_service.py`)

- `get_system_config(db) -> SystemConfig` — Check Redis cache first (`system_config` key, 60s TTL). On miss, query DB. If no row exists, create one with defaults from `constants.py` and cache it.
- `update_system_config(db, updates, updated_by) -> SystemConfig` — Partial update of the single row. Invalidate Redis cache after write. Log activity (SYSTEM_CONFIG_UPDATED).

**Redis integration:** Uses existing Redis connection from `config.py`. Serializes config as JSON. Cache invalidation is a simple DELETE on the key.

**Constants fallback:** `constants.py` values remain as hardcoded defaults. They are used only when creating the initial SystemConfig row. After that, all reads come from DB/cache.

### 3.2 Vendor Config Service (`services/vendor_config_service.py`)

- `get_vendor_config(db, vendor_id) -> VendorConfig` — Fetch by vendor_id. If not found, create with defaults and return.
- `update_vendor_config(db, vendor_id, updates) -> VendorConfig` — Partial update. Lazy-create if needed.
- `get_vendor_exclusions(db, vendor_id) -> list[VendorLenderExclusion]` — All exclusions for vendor, joined with Organization for lender name display.
- `add_vendor_exclusion(db, vendor_id, lender_id) -> VendorLenderExclusion` — Create exclusion. Raise if duplicate.
- `remove_vendor_exclusion(db, vendor_id, lender_id) -> None` — Delete exclusion row.
- `get_excluded_vendor_ids_for_lender(db, lender_id) -> list[UUID]` — All vendor_ids that have excluded this lender. Used by listings browse filter.

### 3.3 Lender Config Service (`services/lender_config_service.py`)

- `get_lender_config(db, lender_id) -> LenderConfig` — Fetch or lazy-create.
- `get_vendor_preferences(db, lender_id) -> list[dict]` — All LenderVendorPreference rows for this lender, joined with Vendor/Organization for display names.
- `set_vendor_preference(db, lender_id, vendor_id, auto_approve) -> LenderVendorPreference` — Upsert: create or update the preference row.
- `is_auto_approve(db, lender_id, vendor_id) -> bool` — Single check: does a preference row exist with `auto_approve=True`? Returns `False` if no row.

---

## 4. API Endpoints

### 4.1 Admin System Config (`api/admin/system_config.py`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/system-config` | Get current system config |
| PUT | `/api/admin/system-config` | Update system config (partial) |

Both require ADMIN role. PUT logs activity (SYSTEM_CONFIG_UPDATED action type).

**Schemas:**
- `SystemConfigResponse`: all config fields + updated_by + updated_at
- `SystemConfigUpdate`: all config fields optional (partial update)

### 4.2 Vendor Config (`api/vendor/config.py`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vendor/settings/config` | Get vendor config + exclusions list |
| PUT | `/api/vendor/settings/config` | Update vendor config fields |
| POST | `/api/vendor/settings/exclusions` | Add lender exclusion |
| DELETE | `/api/vendor/settings/exclusions/{lender_id}` | Remove lender exclusion |

All require VENDOR role. Vendor resolved from current user's organization.

**Schemas:**
- `VendorConfigResponse`: config fields + `exclusions: list[ExclusionEntry]`
- `VendorConfigUpdate`: auto_listing_enabled, price_threshold, separate_valuation_legal (all optional)
- `ExclusionEntry`: lender_id, lender_name, created_at
- `AddExclusionRequest`: lender_id

### 4.3 Lender Config (`api/lender/config.py`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/lender/settings/config` | Get lender config + vendor preferences |
| PUT | `/api/lender/settings/vendors/{vendor_id}/preference` | Set auto-approve for a vendor |

All require LENDER role. Lender resolved from current user's organization.

**Schemas:**
- `LenderConfigResponse`: config fields + `vendor_preferences: list[VendorPreferenceEntry]`
- `VendorPreferenceEntry`: vendor_id, vendor_name, auto_approve
- `SetVendorPreferenceRequest`: auto_approve (bool)

The vendor list in preferences is populated from vendors who have completed at least one request for this lender (query via ReportRequest where the report reached ACCEPTED or later status, joined to the assigned Vendor via the request's broadcast acceptance).

---

## 5. Workflow Wiring

### 5.1 Auto-Approve (Report Submission)

**Where:** `services/report_service.py` — in the report submission/ready handler.

**Logic:** When a report status transitions to READY (vendor submits):
1. Look up the request's `lender_id` and the vendor's `vendor_id`
2. Call `lender_config_service.is_auto_approve(db, lender_id, vendor_id)`
3. If `True`:
   - Set report status to ACCEPTED
   - Call `billing_service.create_billing_entries(...)` (same as manual accept)
   - Send notification to lender: "Report from {vendor_name} was auto-approved"
   - Log activity: REPORT_AUTO_APPROVED
   - Proceed to auto-listing check (Section 5.2) — the auto-approve and auto-listing checks chain together
4. If `False`: existing flow (lender reviews manually)

### 5.2 Auto-Listing (After Report Accepted)

**Where:** After report acceptance (both manual and auto-approve paths).

**Logic:** When a report moves to ACCEPTED status (both manual accept and auto-approve paths):
1. Check that the report was created via a request (has `request_id`) — listing re-purchases are not eligible for auto-listing
2. Look up vendor_id from the report
3. Call `vendor_config_service.get_vendor_config(db, vendor_id)`
4. If `auto_listing_enabled` is `True`:
   - Call existing `listing_service.create_or_add_to_listing(report)` (reuses pin_code + property_type grouping, PII redaction)
   - Send notification to vendor: "Report auto-listed to marketplace"
5. If `False`: existing flow (vendor manually lists)

### 5.3 Lender Exclusions (Listings Browse)

**Where:** `services/listing_service.py` — in the browse/search query.

**Logic:** When a lender browses listings:
1. Call `vendor_config_service.get_excluded_vendor_ids_for_lender(db, lender_id)`
2. If any exclusions exist, add a WHERE clause to the listings query: exclude listings where the owning vendor is in the exclusion list
3. Transparent to the lender — excluded listings simply don't appear

### 5.4 System Config Consumption

Replace hardcoded constant reads in three locations:

1. **`services/broadcast_service.py`** — Read `vendors_per_broadcast_round` and `broadcast_accept_window_minutes` from `system_config_service.get_system_config()` instead of `constants.VENDORS_PER_BROADCAST_ROUND` and `constants.BROADCAST_ACCEPT_WINDOW_MINUTES`.

2. **`jobs/celery_app.py`** (auto-accept task) — Read `auto_accept_days` from system config. Since Celery tasks run outside request context, use `get_async_session_context()` to fetch config.

3. **`api/vendor/reports.py`** (upload validation) — Read `max_upload_size_mb` from system config for file size validation.

The `constants.py` values remain as fallback defaults, used only when creating the initial SystemConfig DB row.

### 5.5 Price Threshold (Broadcast Filtering)

**Where:** `services/broadcast_service.py` — in vendor selection for broadcast rounds.

**Logic:** When selecting vendors for a broadcast round:
1. For each candidate vendor, check `vendor_config_service.get_vendor_config(db, vendor_id).price_threshold`
2. If `price_threshold` is set and the request price is below it, skip this vendor in the broadcast
3. If `price_threshold` is null, include the vendor (no minimum)

---

## 6. Frontend UI

### 6.1 Admin System Config Page (`/admin/settings`)

New page accessible from admin sidebar ("Settings" link after Billing).

**Layout:** Form with four cards:
- **Broadcast Settings**: Vendors per round (number input), Accept window minutes (number input)
- **Acceptance Settings**: Auto-accept days (number input)
- **Upload Settings**: Max upload size MB (number input)
- **Validation Settings**: Required report fields (checkbox list of known field names from TEMPLATE_FIELDS)

Single "Save" button at bottom. Toast on success. Activity log entry created server-side.

### 6.2 Vendor Settings — Configuration Tab

New tab added to existing `/vendor/settings` page (alongside Users, Notifications).

**Layout:** Four cards:
- **Listing Preferences**: Auto-listing toggle (switch component) with explanatory text: "Automatically list accepted reports on the marketplace"
- **Pricing**: Minimum price threshold (currency input). Helper text: "Leave blank to accept all prices"
- **Report Types**: "Separate valuation & legal settings" toggle with explanation
- **Lender Exclusions**: Table showing excluded lenders (name, date added, remove button). "Add Exclusion" button opens a searchable dropdown of all lenders.

### 6.3 Lender Settings — Configuration Tab

New tab added to existing `/lender/settings` page (alongside Users, Report Template, Notifications).

**Layout:** Single card:
- **Vendor Auto-Approve**: Table of vendors the lender has worked with (from completed requests). Columns: vendor name, auto-approve toggle (switch). Search bar to filter the list.

Vendor list populated from `/api/lender/settings/config` which returns vendors with completed requests.

### 6.4 Responsive Behavior

All new pages follow existing responsive patterns:
- Cards stack vertically on mobile
- Tables become card-based lists on mobile (< md breakpoint)
- Touch-friendly toggle switches (min 44px targets)
- Same sidebar behavior as existing settings pages

---

## 7. New Enums

Added to `models/enums.py`:

- **ActivityAction**: `SYSTEM_CONFIG_UPDATED`, `REPORT_AUTO_APPROVED`
- **ActivityTargetType**: `SYSTEM_CONFIG`

No new NotificationEventType needed — auto-approve and auto-listing use existing notification patterns with descriptive messages.

---

## 8. Migration

Single Alembic migration creating five new tables:
- `system_config`
- `vendor_config` (unique constraint on vendor_id)
- `lender_config` (unique constraint on lender_id)
- `lender_vendor_preferences` (unique constraint on lender_id + vendor_id)
- `vendor_lender_exclusions` (unique constraint on vendor_id + lender_id)

No data backfill needed — all config rows are lazy-created on first access.

---

## 9. Files to Create/Modify

### New Files
- `backend/app/models/system_config.py` — SystemConfig model
- `backend/app/models/vendor_config.py` — VendorConfig, VendorLenderExclusion models
- `backend/app/models/lender_config.py` — LenderConfig, LenderVendorPreference models
- `backend/app/schemas/system_config.py` — SystemConfig schemas
- `backend/app/schemas/vendor_config.py` — VendorConfig + Exclusion schemas
- `backend/app/schemas/lender_config.py` — LenderConfig + Preference schemas
- `backend/app/services/system_config_service.py` — System config CRUD + Redis cache
- `backend/app/services/vendor_config_service.py` — Vendor config + exclusions
- `backend/app/services/lender_config_service.py` — Lender config + preferences
- `backend/app/api/admin/system_config.py` — Admin system config endpoints
- `backend/app/api/vendor/config.py` — Vendor config endpoints
- `backend/app/api/lender/config.py` — Lender config endpoints
- `backend/alembic/versions/xxx_add_config_tables.py` — Migration
- `frontend/src/types/config.ts` — Config TypeScript types
- `frontend/src/app/admin/settings/page.tsx` — Admin system config page
- `frontend/src/app/admin/settings/_components/system-config-form.tsx` — Form component

### Modified Files
- `backend/app/models/__init__.py` — Register new models
- `backend/app/models/enums.py` — Add new enum values
- `backend/app/main.py` — Register new routers
- `backend/app/services/broadcast_service.py` — Read from system config + price threshold filtering
- `backend/app/services/report_service.py` — Auto-approve check
- `backend/app/services/listing_service.py` — Auto-listing + exclusion filter
- `backend/app/jobs/celery_app.py` — Auto-accept reads config from DB
- `backend/app/api/vendor/reports.py` — Upload size from config
- `frontend/src/app/vendor/settings/page.tsx` — Add Configuration tab
- `frontend/src/app/lender/settings/page.tsx` — Add Configuration tab
- `frontend/src/app/admin/layout.tsx` — Add Settings nav link
