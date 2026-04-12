# Phase 12C: Polish & Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-harden the platform with pagination, rate limiting, query optimization, missing indexes, file cleanup, and error handling polish.

**Architecture:** Seven independent hardening concerns applied across existing code. No new models — only infrastructure additions (slowapi, cleanup job) and targeted modifications to existing routers, services, and models.

**Tech Stack:** slowapi (rate limiting), Redis (storage backend), Celery Beat (cleanup job), Alembic (index migration)

**Spec:** `docs/superpowers/specs/2026-04-12-phase12c-polish-hardening-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/core/rate_limit.py` | slowapi Limiter instance + Redis storage |
| `backend/app/jobs/cleanup_tasks.py` | Orphaned file cleanup Celery task |

### Modified Files

| File | Change |
|------|--------|
| `backend/pyproject.toml` | Add slowapi dependency |
| `backend/app/main.py` | Attach rate limit middleware + exception handler |
| `backend/app/api/auth.py` | Rate limit decorators on 5 endpoints |
| `backend/app/api/admin/accounts.py` | Pagination on 6 endpoints |
| `backend/app/api/admin/pricing.py` | Pagination on 1 endpoint |
| `backend/app/api/admin/billing.py` | Pagination on 1 endpoint |
| `backend/app/api/lender/settings.py` | Pagination on 1 endpoint |
| `backend/app/api/vendor/settings.py` | Pagination on 1 endpoint |
| `backend/app/api/vendor/reports.py` | Pagination on 2 endpoints |
| `backend/app/services/broadcast_service.py` | Batch-fetch VendorConfig + VendorUser |
| `backend/app/models/billing.py` | Add index=True to FK columns |
| `backend/app/models/request.py` | Add index=True to FK columns |
| `backend/app/jobs/celery_app.py` | Add cleanup job to beat schedule |
| `backend/app/services/push_service.py` | Specific exception type |
| `backend/app/services/activity_log_service.py` | Specific exception type |
| `backend/app/services/ocr/ocr_service.py` | Specific exception type |
| `backend/app/api/common/polling.py` | Add RBAC design comment |

---

### Task 1: Missing Indexes + Migration

**Files:**
- Modify: `backend/app/models/billing.py`
- Modify: `backend/app/models/request.py`

- [ ] **Step 1: Add indexes to billing models**

In `backend/app/models/billing.py`, add `index=True` to FK columns on VendorEarning and LenderPayable. Read the file first, then for each FK `mapped_column(ForeignKey(...))` that lacks `index=True`, add it.

VendorEarning columns to index: `vendor_id`, `report_id`, `lender_id`
LenderPayable columns to index: `lender_id`, `report_id`

Example change pattern:
```python
# Before:
vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
# After:
vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"), index=True)
```

- [ ] **Step 2: Add indexes to request models**

In `backend/app/models/request.py`, add `index=True` to:

ReportRequest: `branch_id`, `vendor_specified_id`
RequestAcceptance: `report_id`

Same pattern as Step 1.

- [ ] **Step 3: Generate and run migration**

```bash
docker compose -f docker-compose.local.yml exec backend alembic revision --autogenerate -m "add missing fk indexes"
docker compose -f docker-compose.local.yml exec backend alembic upgrade head
docker cp propeval-backend-1:/app/alembic/versions/<generated_file>.py backend/alembic/versions/
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/billing.py backend/app/models/request.py backend/alembic/versions/
git commit -m "feat(phase12c): add missing FK indexes on billing and request models"
```

---

### Task 2: Rate Limiting Setup

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/app/core/rate_limit.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add slowapi dependency**

```bash
cd backend && poetry add slowapi && poetry lock
```

Rebuild the backend container:
```bash
cd .. && docker compose -f docker-compose.local.yml build backend
docker compose -f docker-compose.local.yml up -d backend
```

- [ ] **Step 2: Create rate_limit.py**

Create `backend/app/core/rate_limit.py`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL,
)
```

- [ ] **Step 3: Attach middleware to app**

In `backend/app/main.py`, add imports:

```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter
```

After `app = FastAPI(...)`, add:

```python
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

- [ ] **Step 4: Verify app starts**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.core.rate_limit import limiter; print('limiter OK')"
```

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/poetry.lock backend/app/core/rate_limit.py backend/app/main.py
git commit -m "feat(phase12c): add slowapi rate limiting infrastructure"
```

---

### Task 3: Rate Limit Auth Endpoints

**Files:**
- Modify: `backend/app/api/auth.py`

- [ ] **Step 1: Read the auth router file**

Read `backend/app/api/auth.py` to see exact function signatures.

- [ ] **Step 2: Add rate limit decorators**

Add import at top:

```python
from starlette.requests import Request
from app.core.rate_limit import limiter
```

Add `@limiter.limit()` decorator to each auth endpoint. If the function already has a `request: Request` parameter, keep it. If not, add it.

Apply these limits:

```python
@router.post("/login")
@limiter.limit("10/minute")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
```

```python
@router.post("/login-otp")
@limiter.limit("5/minute")
async def login_otp(body: OTPRequest, request: Request, db: AsyncSession = Depends(get_db)):
```

```python
@router.post("/verify-otp")
@limiter.limit("5/minute")
async def verify_otp_endpoint(body: OTPVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
```

```python
@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
```

```python
@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password_endpoint(body: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
```

**Important:** The `@limiter.limit()` decorator must be placed AFTER the `@router.post()` decorator (closer to the function). The `request: Request` parameter is required by slowapi — add it if not present. The login endpoint already has it.

- [ ] **Step 3: Verify imports**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.api.auth import router; print('Auth router OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/auth.py
git commit -m "feat(phase12c): add rate limiting to auth endpoints"
```

---

### Task 4: Pagination — Admin Accounts (6 endpoints)

**Files:**
- Modify: `backend/app/api/admin/accounts.py`

- [ ] **Step 1: Read the file**

Read `backend/app/api/admin/accounts.py` to see all 6 list endpoints.

- [ ] **Step 2: Add pagination to all 6 endpoints**

For each of these endpoints, add `page: int = Query(1, ge=1)` and `page_size: int = Query(20, ge=1, le=100)` parameters. Make sure `Query` is imported from `fastapi`.

The endpoints all call service functions that return full lists. Add slicing at the router level after the service call:

```python
@router.get("/lenders", response_model=list[LenderResponse])
async def list_lenders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    all_results = await lender_service.list_lenders(db)
    start = (page - 1) * page_size
    return all_results[start : start + page_size]
```

Apply the same pattern to all 6:
1. `list_lenders` (line ~35)
2. `list_lender_branches` (line ~79)
3. `list_lender_users` (line ~107)
4. `list_vendors` (line ~150)
5. `list_vendor_users` (line ~200)
6. `list_vendor_service_areas` (line ~242)

Each one: add `page` and `page_size` params, slice the result.

- [ ] **Step 3: Verify**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.api.admin.accounts import router; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/admin/accounts.py
git commit -m "feat(phase12c): add pagination to admin accounts endpoints"
```

---

### Task 5: Pagination — Admin Pricing + Billing

**Files:**
- Modify: `backend/app/api/admin/pricing.py`
- Modify: `backend/app/api/admin/billing.py`

- [ ] **Step 1: Read both files**

Read `backend/app/api/admin/pricing.py` and `backend/app/api/admin/billing.py`.

- [ ] **Step 2: Add pagination to pricing rules**

In `backend/app/api/admin/pricing.py`, the `list_rules` endpoint calls `pricing_service.list_pricing_rules(...)`. Add `page` and `page_size` params, slice the result:

```python
@router.get("/rules", response_model=list[PricingRuleResponse])
async def list_rules(
    lender_id: UUID = Query(...),
    city: str | None = Query(None),
    report_category: str | None = Query(None),
    property_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    all_results = await pricing_service.list_pricing_rules(
        db, lender_id=lender_id, city=city,
        report_category=report_category, property_type=property_type,
    )
    start = (page - 1) * page_size
    return all_results[start : start + page_size]
```

- [ ] **Step 3: Add pagination to invoices**

In `backend/app/api/admin/billing.py`, the `list_invoices` endpoint calls `billing_service.get_invoices(...)`. Same pattern — add params and slice:

Add `page: int = Query(1, ge=1)` and `page_size: int = Query(20, ge=1, le=100)` to the function signature. After building the results list, slice it:

```python
    start = (page - 1) * page_size
    return results[start : start + page_size]
```

- [ ] **Step 4: Verify**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.api.admin.pricing import router; from app.api.admin.billing import router; print('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/admin/pricing.py backend/app/api/admin/billing.py
git commit -m "feat(phase12c): add pagination to admin pricing and billing endpoints"
```

---

### Task 6: Pagination — Vendor/Lender Settings + Vendor Reports

**Files:**
- Modify: `backend/app/api/vendor/settings.py`
- Modify: `backend/app/api/lender/settings.py`
- Modify: `backend/app/api/vendor/reports.py`

- [ ] **Step 1: Read all three files**

Read each file to see the current endpoint code.

- [ ] **Step 2: Add pagination to vendor settings users**

In `backend/app/api/vendor/settings.py`, the `list_org_users` endpoint calls `user_service.list_users_by_org(...)`. Add params and slice:

```python
@router.get("/users", response_model=list[UserResponse])
async def list_org_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no organization")
    all_results = await user_service.list_users_by_org(db, current_user.organization_id)
    start = (page - 1) * page_size
    return all_results[start : start + page_size]
```

Ensure `Query` is imported from `fastapi`.

- [ ] **Step 3: Add pagination to lender settings users**

Same pattern in `backend/app/api/lender/settings.py`:

```python
@router.get("/users", response_model=list[UserResponse])
async def list_org_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no organization")
    all_results = await user_service.list_users_by_org(db, current_user.organization_id)
    start = (page - 1) * page_size
    return all_results[start : start + page_size]
```

- [ ] **Step 4: Add pagination to vendor bulk-jobs**

In `backend/app/api/vendor/reports.py`, the `list_bulk_jobs` endpoint has an inline query. Add params and apply `.offset().limit()` to the query:

```python
@router.get("/bulk-jobs", response_model=list[BulkUploadJobResponse])
async def list_bulk_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    result = await db.execute(
        select(BulkUploadJob)
        .where(BulkUploadJob.vendor_id == vendor_id)
        .order_by(BulkUploadJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all())
```

- [ ] **Step 5: Add pagination to vendor bulk-job reports**

Same pattern for `get_bulk_job_reports`:

Add `page: int = Query(1, ge=1)` and `page_size: int = Query(20, ge=1, le=100)` params. Apply `.offset((page - 1) * page_size).limit(page_size)` to the `select(Report)` query before execution.

- [ ] **Step 6: Verify**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.api.vendor.settings import router; from app.api.lender.settings import router; from app.api.vendor.reports import router; print('OK')"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/vendor/settings.py backend/app/api/lender/settings.py backend/app/api/vendor/reports.py
git commit -m "feat(phase12c): add pagination to vendor/lender settings and vendor reports"
```

---

### Task 7: N+1 Fix in Broadcast Service

**Files:**
- Modify: `backend/app/services/broadcast_service.py`

- [ ] **Step 1: Read the current file**

Read `backend/app/services/broadcast_service.py` to see the current code after Phase 12B changes.

- [ ] **Step 2: Fix price threshold N+1 in `get_eligible_vendors`**

The current code (added in Phase 12B) loops through vendors calling `get_vendor_config()` per vendor. Replace with a batch query.

Find the price threshold filtering section and replace it with:

```python
    vendors = list(result.scalars().all())

    # Filter by vendor price threshold (batch query instead of N+1)
    if request_price is not None:
        from app.models.vendor_config import VendorConfig
        vendor_ids = [v.id for v in vendors]
        if vendor_ids:
            config_result = await db.execute(
                select(VendorConfig).where(VendorConfig.vendor_id.in_(vendor_ids))
            )
            config_map = {c.vendor_id: c for c in config_result.scalars().all()}
            vendors = [
                v for v in vendors
                if v.id not in config_map
                or config_map[v.id].price_threshold is None
                or request_price >= config_map[v.id].price_threshold
            ]

    return vendors
```

Note: vendors without a VendorConfig row (not yet lazy-created) have no threshold — include them (`v.id not in config_map`).

- [ ] **Step 3: Fix notification N+1 in `start_broadcast`**

In `start_broadcast`, replace the per-vendor VendorUser loop with a batch query.

Replace the existing notification loop (lines ~113-128) with:

```python
    # Batch-fetch all vendor users for notification
    vendor_ids = [v.id for v in batch]
    vu_result = await db.execute(
        select(VendorUser.vendor_id, VendorUser.user_id)
        .where(VendorUser.vendor_id.in_(vendor_ids))
    )
    vendor_user_map: dict[uuid.UUID, list[uuid.UUID]] = {}
    for row in vu_result.all():
        vendor_user_map.setdefault(row.vendor_id, []).append(row.user_id)

    all_notified_user_ids = []
    for vid in vendor_ids:
        for user_id in vendor_user_map.get(vid, []):
            await notification_service.create_notification(
                db,
                user_id=user_id,
                event_type=NotificationEventType.NEW_BROADCAST,
                title="New request broadcast",
                message=f"{request.report_category.value} report request for {request.property_address or 'a property'}",
                reference_id=request.id,
                reference_type=NotificationReferenceType.REQUEST,
            )
            all_notified_user_ids.append(user_id)
```

Add `import uuid` at the top of the file if not already there.

- [ ] **Step 4: Fix notification N+1 in `advance_broadcast_round`**

Apply the exact same batch-fetch pattern to the notification loop in `advance_broadcast_round` (lines ~188-203). Same code as Step 3.

- [ ] **Step 5: Verify**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.broadcast_service import start_broadcast, get_eligible_vendors; print('OK')"
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/broadcast_service.py
git commit -m "feat(phase12c): fix N+1 queries in broadcast service with batch fetching"
```

---

### Task 8: Orphaned File Cleanup Celery Task

**Files:**
- Create: `backend/app/jobs/cleanup_tasks.py`
- Modify: `backend/app/jobs/celery_app.py`

- [ ] **Step 1: Create cleanup task**

Create `backend/app/jobs/cleanup_tasks.py`:

```python
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from app.jobs.celery_app import celery_app

logger = logging.getLogger(__name__)

ONE_DAY_AGO_SECONDS = 86400


def _list_files(directory: str) -> list[str]:
    """List all files in directory tree, relative to MEDIA_ROOT."""
    files = []
    base = Path(directory)
    if not base.exists():
        return files
    for f in base.rglob("*"):
        if f.is_file():
            files.append(str(f))
    return files


def _is_old_enough(filepath: str) -> bool:
    """Check if file is older than 24 hours (avoid race with in-progress uploads)."""
    try:
        mtime = os.path.getmtime(filepath)
        age = datetime.now(timezone.utc).timestamp() - mtime
        return age > ONE_DAY_AGO_SECONDS
    except OSError:
        return False


async def _cleanup_reports(db_session) -> int:
    """Delete report PDFs not referenced by any active report."""
    from sqlalchemy import select
    from app.core.constants import MEDIA_ROOT, REPORTS_DIR
    from app.models.report import Report

    reports_dir = f"{MEDIA_ROOT}/{REPORTS_DIR}"
    all_files = _list_files(reports_dir)
    if not all_files:
        return 0

    result = await db_session.execute(
        select(Report.uploaded_file_path).where(Report.uploaded_file_path.isnot(None))
    )
    active_paths = {f"{MEDIA_ROOT}/{p}" for p in result.scalars().all() if p}

    # Also check rendered PDF paths
    result2 = await db_session.execute(
        select(Report.rendered_pdf_path).where(Report.rendered_pdf_path.isnot(None))
    )
    active_paths.update(f"{MEDIA_ROOT}/{p}" for p in result2.scalars().all() if p)

    deleted = 0
    for filepath in all_files:
        if filepath not in active_paths and _is_old_enough(filepath):
            try:
                os.remove(filepath)
                logger.debug("Deleted orphaned report file: %s", filepath)
                deleted += 1
            except OSError as e:
                logger.warning("Failed to delete %s: %s", filepath, e)

    return deleted


async def _cleanup_logos(db_session) -> int:
    """Delete logo files not referenced by any template."""
    from sqlalchemy import select
    from app.core.constants import MEDIA_ROOT, LOGOS_DIR
    from app.models.template import ReportTemplate

    logos_dir = f"{MEDIA_ROOT}/{LOGOS_DIR}"
    all_files = _list_files(logos_dir)
    if not all_files:
        return 0

    result = await db_session.execute(
        select(ReportTemplate.logo_path).where(ReportTemplate.logo_path.isnot(None))
    )
    active_paths = {f"{MEDIA_ROOT}/{p}" for p in result.scalars().all() if p}

    deleted = 0
    for filepath in all_files:
        if filepath not in active_paths and _is_old_enough(filepath):
            try:
                os.remove(filepath)
                logger.debug("Deleted orphaned logo file: %s", filepath)
                deleted += 1
            except OSError as e:
                logger.warning("Failed to delete %s: %s", filepath, e)

    return deleted


async def _run_cleanup():
    from app.core.database import get_async_session_context

    async with get_async_session_context() as db:
        reports_deleted = await _cleanup_reports(db)
        logos_deleted = await _cleanup_logos(db)
        logger.info(
            "Orphaned file cleanup complete: %d reports, %d logos deleted",
            reports_deleted, logos_deleted,
        )


@celery_app.task(bind=True, name="app.jobs.cleanup_tasks.cleanup_orphaned_files")
def cleanup_orphaned_files(self):
    """Weekly cleanup of orphaned media files."""
    logger.info("Starting orphaned file cleanup")
    asyncio.run(_run_cleanup())
```

- [ ] **Step 2: Add to beat schedule**

In `backend/app/jobs/celery_app.py`, add to `beat_schedule`:

```python
    "cleanup-orphaned-files": {
        "task": "app.jobs.cleanup_tasks.cleanup_orphaned_files",
        "schedule": crontab(day_of_week=0, hour=3, minute=0),
    },
```

Make sure `crontab` is already imported (it should be from the existing beat schedule entries).

- [ ] **Step 3: Verify task imports**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.jobs.cleanup_tasks import cleanup_orphaned_files; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/jobs/cleanup_tasks.py backend/app/jobs/celery_app.py
git commit -m "feat(phase12c): add weekly orphaned file cleanup Celery task"
```

---

### Task 9: Error Handling Polish

**Files:**
- Modify: `backend/app/services/push_service.py`
- Modify: `backend/app/services/activity_log_service.py`
- Modify: `backend/app/services/ocr/ocr_service.py`

- [ ] **Step 1: Read all three files**

Read the try/except sections in each file.

- [ ] **Step 2: Fix push_service.py**

In `backend/app/services/push_service.py`, the current code has:

```python
except Exception:
    logger.exception("Push failed for endpoint %s", sub.endpoint[:50])
```

This is a fallback after the `WebPushException` catch. Remove the bare `except Exception` block entirely — the `WebPushException` catch already handles push-specific errors. Any other exception should propagate (it's a programming bug, not a push failure).

- [ ] **Step 3: Fix activity_log_service.py**

In `backend/app/services/activity_log_service.py`, change:

```python
except Exception:
    logger.exception("Failed to log activity: %s %s", action, target_id)
```

to:

```python
except SQLAlchemyError:
    logger.exception("Failed to log activity: %s %s", action, target_id)
```

Add import at top:
```python
from sqlalchemy.exc import SQLAlchemyError
```

- [ ] **Step 4: Fix ocr_service.py**

In `backend/app/services/ocr/ocr_service.py`, change:

```python
except Exception:
    logger.exception("OCR extraction failed for report %s", report.id)
    report.status = ReportStatus.EXTRACTION_FAILED
```

to:

```python
except (anthropic.APIError, anthropic.APIConnectionError) as e:
    logger.exception("OCR extraction failed for report %s: %s", report.id, e)
    report.status = ReportStatus.EXTRACTION_FAILED
```

Check if `anthropic` is already imported at the top of the file. If it's lazy-imported, add the import inside the try block or at the function level.

- [ ] **Step 5: Add RBAC comment to polling endpoint**

In `backend/app/api/common/polling.py`, add a comment above the `get_current_user` dependency:

```python
@router.get("/poll", response_model=PollResponse)
async def poll(
    since: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    # Intentionally uses get_current_user (not require_role) — this endpoint
    # serves all authenticated users (vendor, lender, admin) and filters
    # data by user_type at runtime.
    current_user: User = Depends(get_current_user),
):
```

- [ ] **Step 6: Verify**

```bash
docker compose -f docker-compose.local.yml exec backend python -c "from app.services.push_service import send_push_to_users; from app.services.activity_log_service import log_activity; print('OK')"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/push_service.py backend/app/services/activity_log_service.py backend/app/services/ocr/ocr_service.py backend/app/api/common/polling.py
git commit -m "feat(phase12c): polish error handling and add RBAC documentation"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Phase 12C completion status**

In the Current Status section, after the Phase 12B line, add:

```
**Phase 12C (Polish & Hardening):** Complete — Pagination on 12 list endpoints, rate limiting on 5 auth endpoints (slowapi + Redis), N+1 query fix in broadcast service (batch VendorConfig + VendorUser), 8 missing FK indexes added, weekly orphaned file cleanup Celery job, error handling polish (specific exception types in push/activity/OCR services)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(phase12c): update CLAUDE.md with Phase 12C completion status"
```
