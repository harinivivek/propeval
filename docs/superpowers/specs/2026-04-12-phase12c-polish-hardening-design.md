# Phase 12C: Polish & Hardening — Design Spec

**Date:** 2026-04-12
**Phase:** 12C of 12 (A: Billing & Invoicing [complete], B: System & Entity Config [complete], C: Polish & Hardening)
**Scope:** Pagination, rate limiting, N+1 query fix, missing indexes, orphaned file cleanup, error handling polish, RBAC consistency

---

## 1. Overview

Phase 12C is the final production-readiness pass. Based on a comprehensive audit of the codebase, seven categories of issues were identified:

1. **12 list endpoints missing pagination** — unbounded result sets
2. **5 auth endpoints with no rate limiting** — brute force risk
3. **N+1 queries in broadcast service** — performance bottleneck
4. **8 FK columns missing indexes** — query performance at scale
5. **No orphaned file cleanup** — storage accumulation
6. **3 services with bare `except Exception`** — masked errors
7. **1 polling endpoint without explicit RBAC documentation** — consistency

Items already verified as adequate (no work needed): PII redaction (whitelist approach), input validation (file type/size checks), lazy loading (async-safe patterns), general RBAC (all endpoints use `require_role()`).

---

## 2. Pagination

Add `page` and `page_size` query parameters to 12 list endpoints. Apply `.offset((page-1)*page_size).limit(page_size)` to the query. Default: `page=1, page_size=20, max=100`.

### Endpoints to Paginate

**Admin accounts** (`api/admin/accounts.py`):
- GET `/api/admin/accounts/lenders` (line 35)
- GET `/api/admin/accounts/lenders/{id}/branches` (line 79)
- GET `/api/admin/accounts/lenders/{id}/users` (line 107)
- GET `/api/admin/accounts/vendors` (line 150)
- GET `/api/admin/accounts/vendors/{id}/users` (line 200)
- GET `/api/admin/accounts/vendors/{id}/service-areas` (line 242)

**Admin pricing** (`api/admin/pricing.py`):
- GET `/api/admin/pricing/rules` (line 21)

**Admin billing** (`api/admin/billing.py`):
- GET `/api/admin/billing/invoices` (line 24)

**Lender** (`api/lender/`):
- GET `/api/lender/settings/users` (line 16 of settings.py)

**Vendor** (`api/vendor/`):
- GET `/api/vendor/settings/users` (line 16 of settings.py)
- GET `/api/vendor/reports/bulk-jobs` (line 95 of reports.py)
- GET `/api/vendor/reports/bulk-jobs/{id}/reports` (line 127 of reports.py)

### Pattern

For each endpoint, add parameters:
```python
page: int = Query(1, ge=1),
page_size: int = Query(20, ge=1, le=100),
```

Apply to the query before execution:
```python
stmt = stmt.offset((page - 1) * page_size).limit(page_size)
```

No total count wrapper needed — these are admin/settings lists that are small and bounded. If a frontend needs total count later, it can be added per-endpoint.

---

## 3. Rate Limiting

### Setup

- Add `slowapi` and `limits` to `backend/pyproject.toml`
- Create `backend/app/core/rate_limit.py`:
  - `Limiter` instance with `key_func=get_remote_address`
  - Redis storage backend using `settings.REDIS_URL`
- Attach `SlowAPIMiddleware` and `SlowAPIASGIMiddleware` to the app in `main.py`
- Add custom 429 exception handler for clean JSON error responses

### Endpoint Limits

| Endpoint | Path | Limit | Key |
|----------|------|-------|-----|
| Login | POST `/api/auth/login` | 10/minute | IP |
| Request OTP | POST `/api/auth/login-otp` | 5/minute | IP |
| Verify OTP | POST `/api/auth/verify-otp` | 5/minute | IP |
| Forgot password | POST `/api/auth/forgot-password` | 3/minute | IP |
| Reset password | POST `/api/auth/reset-password` | 5/minute | IP |

### Implementation

Each auth endpoint gets a `@limiter.limit("N/minute")` decorator. The `request: Request` parameter must be present in the function signature (slowapi requirement — add it if missing via `request: Request` from `starlette.requests`).

429 response format:
```json
{"detail": "Rate limit exceeded. Try again in N seconds."}
```

---

## 4. N+1 Query Fix — Broadcast Service

### Problem

In `broadcast_service.py`:
1. **Price threshold filtering** (added in Phase 12B): loops through vendors calling `get_vendor_config(db, vendor.id)` per vendor — N queries for N vendors.
2. **Notification loops**: fetches `VendorUser` per vendor_id inside a loop — one query per vendor in the batch.

### Fix

**Price threshold** — In `get_eligible_vendors()`, after the initial vendor query returns the list, batch-fetch all VendorConfig rows:

```python
from app.models.vendor_config import VendorConfig

vendor_ids = [v.id for v in vendors]
config_result = await db.execute(
    select(VendorConfig).where(VendorConfig.vendor_id.in_(vendor_ids))
)
config_map = {c.vendor_id: c for c in config_result.scalars().all()}

if request_price is not None:
    vendors = [
        v for v in vendors
        if config_map.get(v.id) is None
        or config_map[v.id].price_threshold is None
        or request_price >= config_map[v.id].price_threshold
    ]
```

Note: vendors without a VendorConfig row (not yet lazy-created) have no threshold — include them.

**Notifications** — In `start_broadcast()` and `advance_broadcast_round()`, replace the per-vendor VendorUser loop with a single batch query:

```python
vendor_ids = [v.id for v in batch]
vu_result = await db.execute(
    select(VendorUser.vendor_id, VendorUser.user_id)
    .where(VendorUser.vendor_id.in_(vendor_ids))
)
vendor_user_map = {}
for row in vu_result.all():
    vendor_user_map.setdefault(row.vendor_id, []).append(row.user_id)
```

Then iterate the map for notifications instead of querying per vendor.

---

## 5. Missing Indexes

Add `index=True` to 8 FK columns. Single Alembic migration.

| Model | Table | Column | File |
|-------|-------|--------|------|
| VendorEarning | vendor_earnings | vendor_id | models/billing.py |
| VendorEarning | vendor_earnings | report_id | models/billing.py |
| VendorEarning | vendor_earnings | lender_id | models/billing.py |
| LenderPayable | lender_payables | lender_id | models/billing.py |
| LenderPayable | lender_payables | report_id | models/billing.py |
| ReportRequest | report_requests | branch_id | models/request.py |
| ReportRequest | report_requests | vendor_specified_id | models/request.py |
| RequestAcceptance | request_acceptances | report_id | models/request.py |

Change: Add `index=True` to each `mapped_column(ForeignKey(...))` call.

---

## 6. Orphaned File Cleanup

### Celery Beat Job

New task `cleanup_orphaned_files` in `backend/app/jobs/cleanup_tasks.py`, scheduled weekly (Sundays 03:00 AM) via Celery Beat.

### Logic

1. **Reports directory** (`media/reports/`):
   - List all files in the directory tree
   - Query `Report.file_path` for all active reports (non-null file_path)
   - Delete files not in the active set
   - Log count of deleted files

2. **Logos directory** (`media/logos/`):
   - List all files
   - Query `ReportTemplate.logo_path` for all templates (non-null logo_path)
   - Delete files not referenced
   - Log count

3. **Rendered PDFs directory** (`media/rendered/`):
   - List all files
   - Query `Report.rendered_pdf_path` for all reports (non-null)
   - Delete orphans
   - Log count

### Safety

- Only delete files older than 24 hours (avoid race condition with in-progress uploads)
- Log each deleted file path at DEBUG level
- Log summary count at INFO level
- Uses `get_async_session_context()` pattern (same as billing_tasks.py)

### Beat Schedule

```python
"cleanup-orphaned-files": {
    "task": "app.jobs.cleanup_tasks.cleanup_orphaned_files",
    "schedule": crontab(day_of_week=0, hour=3, minute=0),
}
```

---

## 7. Error Handling Polish

### push_service.py (line ~93)

**Before:** `except Exception`
**After:** `except pywebpush.WebPushException as e`

Additional: if the push response status is 410 (Gone), delete the PushSubscription row — the endpoint is permanently invalid. Log specific error details.

### activity_log_service.py (line ~37)

**Before:** `except Exception`
**After:** `except SQLAlchemyError as e`

Keep the "log and continue" behavior — audit logging should not break the main request flow. But only catch DB errors; let unexpected errors (e.g., programming bugs) propagate.

### ocr/ocr_service.py (line ~36)

**Before:** `except Exception`
**After:** `except anthropic.APIError as e`

Log with report_id for traceability. Re-raise as the existing domain error type so callers can handle appropriately. Let non-API errors (programming bugs) propagate naturally.

---

## 8. RBAC Consistency

The polling endpoint (`api/common/polling.py:23`) uses `get_current_user` without `require_role()`. This is intentional — the endpoint serves all authenticated users (vendor, lender, admin) and filters data by `user_type` at runtime.

**Action:** Add a code comment documenting this design choice. No functional change needed.

---

## 9. Files to Create/Modify

### New Files
- `backend/app/core/rate_limit.py` — Limiter instance + Redis storage config
- `backend/app/jobs/cleanup_tasks.py` — Orphaned file cleanup Celery task

### Modified Files
- `backend/pyproject.toml` — Add slowapi dependency
- `backend/app/main.py` — Attach rate limit middleware
- `backend/app/api/auth.py` — Add rate limit decorators to 5 endpoints
- `backend/app/api/admin/accounts.py` — Add pagination to 6 endpoints
- `backend/app/api/admin/pricing.py` — Add pagination to 1 endpoint
- `backend/app/api/admin/billing.py` — Add pagination to 1 endpoint
- `backend/app/api/lender/settings.py` — Add pagination to 1 endpoint
- `backend/app/api/vendor/settings.py` — Add pagination to 1 endpoint
- `backend/app/api/vendor/reports.py` — Add pagination to 2 endpoints
- `backend/app/services/broadcast_service.py` — Batch-fetch VendorConfig + VendorUser
- `backend/app/models/billing.py` — Add index=True to 5 FK columns
- `backend/app/models/request.py` — Add index=True to 3 FK columns
- `backend/app/jobs/celery_app.py` — Add cleanup job to beat schedule
- `backend/app/services/push_service.py` — Specific exception handling
- `backend/app/services/activity_log_service.py` — Specific exception handling
- `backend/app/services/ocr/ocr_service.py` — Specific exception handling
- `backend/app/api/common/polling.py` — Add RBAC design comment
- `backend/alembic/versions/xxx_add_missing_indexes.py` — Index migration
