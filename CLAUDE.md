# PropEval — Property Valuation & Legal Reports Marketplace

## Stack

- **Backend:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async), Alembic, Celery + Redis
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Database:** PostgreSQL 16
- **Cache/Queue:** Redis 7, Celery with Celery Beat
- **Auth:** JWT (python-jose), bcrypt 4.0.1 (pinned for passlib compatibility), RBAC
- **OTP:** Mock service (Redis-backed, console-logged). DEV_OTP `123456` always accepted in local/dev.

## Architecture

- FastAPI backend on port 8020, Next.js frontend on port 3020 (offset to avoid SV-platform conflicts)
- Postgres on 5433, Redis on 6380
- Three portals: Lender (`/lender/*`), Vendor (`/vendor/*`), Admin (`/admin/*`)
- JWT auth (access + refresh tokens) with role-based access control
- Celery workers for OCR, broadcast rotation, auto-accept, billing
- Docker Compose for local/dev/prod environments

## Business Context

B2B marketplace connecting **Lenders** (banks/NBFCs) with **Vendors** (property valuers + lawyers) for property valuation and legal due diligence reports. Operated by **Get-It-Right (GTR)** as platform admin.

Three user types: Lender, Vendor, Admin (GTR).
Three core workflows: New request, Listing purchase, Update/Nearby requests.

## Current Status

**Phase 0 (Scaffold):** Complete — monorepo, Docker, CI/CD, Makefile
**Phase 1 (Auth & Users):** Complete — auth, OTP, RBAC, account management, login UI, responsive design
**Phase 2 (Pricing & Reports):** Complete — 11 data models, pricing service, admin pricing API + UI
**Phase 3 (Workflow 1 — New Request):** Complete — 4 backend services (request, broadcast, report, billing), 4 API routers (lender requests, vendor requests, polling, download), 2 Celery jobs (auto-accept, broadcast rotation), 5 frontend pages (lender list/new/detail, vendor list/detail), polling hook, file upload
**Phase 4 (OCR & Report Processing):** Complete — OCR service abstraction (OcrProvider → ClaudeOcrProvider → OcrService), Celery tasks (single + batch), PDF compression (pikepdf), BulkUploadJob model, vendor reports API (7 endpoints), extraction review UI with confidence indicators, bulk upload page, bulk job status page
**Phase 5 (Listings Marketplace):** Complete — listing service (auto-grouping by pin_code + property_type, PII redaction), ReportPurchase model, vendor listings API (4 endpoints: list/delist/browse/listable), lender listings API (5 endpoints: browse/detail/purchase/purchases/download), billing integration (LISTING_DOWNLOAD entries), 5 frontend pages (vendor listings management, lender browse/detail/purchases), sidebar navigation updates
**Phase 6 (Update & Nearby Requests):** Complete — extended request service for UPDATE/NEARBY types with parent_report_id, dynamic billing payable types, 2 new lender API endpoints (update/nearby), update request dialog with predefined checklist, nearby request dialog with address form, parent report context on vendor request detail, request type badges
**Phase 7 (Dashboards & Analytics):** Complete — Notification model + service + API (4 endpoints), dashboard service (13 aggregation functions), CSV export service, 3 dashboard API routers (vendor 5 endpoints, lender 3 endpoints, admin 8 endpoints incl. CSV exports), NotificationBell component with polling, 3 dashboard pages (vendor: stats/receivables/earnings/pending/reports, lender: stats/payables/recent, admin: stats/vendors/lenders/reports/open-requests tabs), notification wiring in broadcast/request/listing services
**Phase 8 (Templates & Report Formatting):** Complete — ReportTemplate model + CRUD service, form-based template builder (header/logo/colors, drag-and-drop field selection/ordering, footer), PDF render service (Jinja2 + WeasyPrint HTML→PDF), template/original download choice via split button, lender settings tabs (Users | Report Template), cached rendered PDFs, download endpoints with ?format=template param
**Phase 9 (Map Views):** Complete — Leaflet + React Leaflet map views, lender listings page map/list toggle with markers and popups, vendor coverage map (/vendor/map) with own reports (green markers) vs competitor density (red circles), listing model lat/lng with coordinate averaging, seed data with geocoordinates across 4 cities (Bengaluru/Mumbai/Delhi/Chennai), vendor map API with competitor area aggregation
**Phase 10 (Notifications & Real-Time):** Complete — Native FastAPI WebSocket with Redis pub/sub for real-time notification delivery, WebSocket connection manager with auto-reconnect and heartbeat, notification preferences (per-event-type opt-out toggles in lender/vendor settings), ActivityLog model with 18 action types, activity log service with admin API (list + CSV export), admin dashboard Activity tab with filters, WebSocketProvider React context wrapping all portal layouts, polling fallback reduced to 60s
**Phase 11 (Mobile PWA):** Complete — @serwist/next service worker with asset caching and push event handlers, PWA manifest with standalone display mode, Web Push notifications via VAPID + pywebpush (triggered on NEW_BROADCAST), PushSubscription model with per-device storage, push API (subscribe/unsubscribe/vapid-key), install banner on vendor dashboard (smart beforeinstallprompt with 7-day dismiss), notification permission banner (3 states: prompt/denied/granted)
**Phase 12A (Billing & Invoicing):** Complete — Monthly invoice generation Celery job (1st of month), structured invoice numbering (GTR-PAY/RCV-YYYY-MM-NNNN), invoice lifecycle management (PENDING → BILLED → PAID), dedicated admin billing page with bulk status updates and CSV export, enhanced vendor receivables with invoice status drill-down and CSV, enhanced lender payables with invoice status drill-down and CSV, notifications on invoice generation and payment confirmation, activity logging for billing events
**Phase 12B (System & Entity Config):** Complete — SystemConfig model with Redis cache (60s TTL) for broadcast/acceptance/upload params, VendorConfig model with auto-listing toggle and price threshold, LenderConfig with per-vendor auto-approve preferences, VendorLenderExclusion for listings visibility filtering, admin system config page (/admin/settings), vendor/lender configuration tabs in settings, workflow wiring (auto-approve in request service, auto-listing on acceptance, price threshold in broadcast, exclusion filter in listings browse, upload size from config)
**Phase 12C (Polish & Hardening):** Complete — Pagination on 12 list endpoints, rate limiting on 5 auth endpoints (slowapi + Redis), N+1 query fix in broadcast service (batch VendorConfig + VendorUser), 8 missing FK indexes added, weekly orphaned file cleanup Celery job, error handling polish (specific exception types in push/activity/OCR services)
**Phase 13 (Vendor Profiles & Trust):** Complete — VendorProfile model (bio, certifications, specialization tags, quality score 0-100, vendor tier), VendorRating model (1-5 stars per request), VendorTier enum (NEW/VERIFIED/TOP_VALUER), quality score composite calculation (rating 30%, acceptance 25%, delivery 20%, revision 15%, OCR 10%), automated tier promotion checks, 8 new API endpoints (vendor profile CRUD + photo + tier, lender vendor view/portfolio/rate, admin tier override), vendor profile editor page with completeness meter, lender public vendor profile page with portfolio/stats, TierBadge + RatingStars + RatingModal shared components, tier card + quality score card on vendor dashboard
**Phase 14 (Unified Marketplace & Discovery):** Complete — Locality model (30 seeded localities across 4 metro cities), Listing extended with locality_id FK, marketplace search service (unified reports + vendors query, geo-bounds, multi-filter), 3 new API endpoints (marketplace/search, marketplace/map-bounds, localities/autocomplete), split-view marketplace page (Leaflet map + card grid on desktop, toggle on mobile), MarketplaceFilters with result type/property/rating/tier filters, ResultCard component (blue document for reports, green person for vendors)
**Phase 15 (Marketplace Pricing):** Complete — PriceBand model (city × property_type × report_category floor/ceiling), VendorPricing model (vendor self-set prices validated against bands), PLATFORM_FEE PayableType for lender-side fees, price band service with CRUD + vendor pricing upsert with band validation, tier restriction (NEW vendors cannot self-price), 5 new API endpoints (admin price band CRUD, vendor pricing get/put), admin price bands management page, vendor pricing page with band indicators
**Phase 16 (Graduated Trust Engine):** Complete — QualityReview model (report gate for New-tier vendors), GTR_REVIEW report status, quality review service (create/queue/detail/approve/return/flag with report status updates), tier demotion Celery tasks (daily 30-day check + day-15 warnings), 3 admin API endpoints (review queue/detail/decision), admin quality review queue page with inline actions

## Seed Data (local)

| Role | Email | Password |
|------|-------|----------|
| GTR Admin | admin@getitright.com | admin123 |
| Lender | lender@abcl.com | lender123 |
| Vendor | vendor@valuepro.com | vendor123 |

Run: `make seed` (or `docker compose exec backend python -m scripts.seed`)

Seed also creates 4 pricing rules for ABCL Bank (Bengaluru: residential/commercial valuation, residential legal, Koramangala area-specific) and 2 service areas for the seed vendor (valuation with 4 areas, city-wide legal).

Run marketplace seed separately: `docker cp backend/scripts/seed_marketplace.py propeval-backend-1:/app/scripts/ && docker compose -f docker-compose.local.yml --env-file .env.local exec backend python -m scripts.seed_marketplace` — creates 4 vendor profiles with tiers, 30 localities (4 cities), and 10 price bands.

## Backend Conventions

### Models
- SQLAlchemy 2.0 `mapped_column` style inheriting from `BaseModel` (UUID PK + timestamps)
- Register all models in `app/models/__init__.py`
- Enums in `app/models/enums.py` with UPPER_SNAKE_CASE values
- Files: `snake_case.py`

### Schemas
- Pydantic v2 with `model_config = {"from_attributes": True}`
- Separate Create/Update/Response schemas per domain
- **Single source of truth:** Don't duplicate schemas across files (e.g., UserResponse lives in `schemas/user.py` only, imported by `schemas/auth.py`)

### Services
- Async functions, called by routers
- Business logic lives here, not in routers
- Enum coercion: services convert string roles to enum values (e.g., `LenderRole(role)`) before passing to models

### Celery Tasks
- Use `get_async_session_context()` from `database.py` for DB access (creates NullPool engine, auto-commits)
- Wrap async code with `asyncio.run()` inside task functions
- Lazy-import heavy dependencies (e.g., `anthropic`) inside functions to avoid import-time failures
- Tasks auto-discovered via `celery_app.autodiscover_tasks(["app.jobs"])`

### Routers
- Prefix: `/api/<domain>/<sub>` (e.g., `/api/lender/settings/users`)
- Use `Depends(get_db)` and `Depends(get_current_user)`
- Use `require_role()` for RBAC
- Don't call `db.commit()` in routers — `get_db` dependency handles commit/rollback

### Migrations
- Alembic with auto-generate: `make migration msg="description"`
- Run: `make migrate`
- **Note:** PYTHONPATH=/app is set in Dockerfile — required for alembic/scripts to find `app` module

### Feature Implementation Order
1. Model in `models/` → register in `__init__.py`
2. Alembic migration
3. Pydantic schemas in `schemas/`
4. Service functions in `services/`
5. Router in `api/` → register in `main.py`
6. Frontend types in `types/`
7. Frontend pages + `_components/`

## Frontend Conventions

- **App Router** with server components by default
- **Portal layouts:** `app/lender/layout.tsx`, `app/vendor/layout.tsx`, `app/admin/layout.tsx`
- **Page components:** `_components/` directory per page
- **API calls:** via `lib/api.ts` typed client (JWT-aware, auto-redirects on 401)
- **Auth hook:** `hooks/use-auth.ts` — manages token storage, user state, login/logout
- **Styling:** Tailwind CSS 4 + shadcn/ui + `cn()` utility
- **Charts:** Recharts
- **Toasts:** Sonner
- **Files:** `kebab-case.ts`, components `PascalCase`

### Responsive Design (mandatory)
- All pages must work on mobile (< 768px), tablet (768-1023px), and desktop (1024px+)
- Vendor users primarily use mobile (PWA)
- **Sidebar:** Collapsible hamburger on mobile/tablet, always visible on desktop (lg+)
- **Tables:** Card-based list view on mobile (< md), full table on desktop
- **Touch targets:** Minimum 44px (py-3 on nav links)
- **Login:** Brand panel hidden on mobile, show logo above form instead
- Guidelines: `docs/superpowers/specs/2026-04-09-responsive-design-guidelines.md`

## Dev Workflow

```bash
make local-up        # Start all services
# NOTE: If `make local-up` fails with port conflicts, use:
# docker compose -f docker-compose.local.yml --env-file .env.local up -d
make local-down      # Stop all services
make local-logs      # Tail logs
make migrate         # Run migrations
make migration msg="add reports table"  # Generate migration
make seed            # Seed database
make test            # Run all tests
make shell-backend   # Shell into backend container
make shell-db        # PostgreSQL CLI
make lint            # Lint backend + frontend
```

## Known Issues & Gotchas

- **bcrypt:** Must pin to 4.0.1 — newer versions break passlib
- **Ports:** Use 8020/3020/5433/6380 to avoid conflicts with SV-platform (8000/3000/5432/6379)
- **PYTHONPATH:** Must be set to `/app` in Dockerfile for alembic and scripts to work
- **Docker volumes:** `backend/app` is volume-mounted for hot reload, but `alembic/` and `scripts/` are baked into the image — rebuild container after changes to those dirs. Similarly, `backend/tests/` is not volume-mounted — copy test files into the container or rebuild to run new tests.
- **Poetry lock:** After adding/removing deps in `pyproject.toml`, run `cd backend && poetry lock` before rebuilding containers. Build will fail with "pyproject.toml changed significantly" otherwise.
- **Alembic migrations from container:** Migrations generated inside Docker stay in the container (alembic/ not volume-mounted). Copy to host with: `docker cp propeval-backend-1:/app/alembic/versions/<file>.py backend/alembic/versions/`
- **Pricing area fallback:** PricingRule uses two unique constraints (one for rows WITH area, one partial index for rows WHERE area IS NULL) to support city+area exact match with fallback to city-level pricing
- **Decimal serialization:** Pydantic serializes `Decimal` fields as strings (e.g., `"2500.00"`). Frontend types use `string` for price fields accordingly
- **Report → Vendor link:** `Report.vendor_id` is the direct FK to vendor. There is NO `Report.request_id`. To find the request for a report, go through `ListingReport` or `RequestAcceptance` separately.
- **Alembic enum reuse:** Autogenerated migrations for tables using existing PG enum types (e.g., `propertytype`) will fail with `CREATE TYPE` duplicate error. Fix: use raw SQL `op.execute("CREATE TABLE ...")` referencing the existing enum type name directly.
- **Running new scripts:** Copy into container first: `docker cp backend/scripts/foo.py propeval-backend-1:/app/scripts/` then `docker compose -f docker-compose.local.yml --env-file .env.local exec backend python -m scripts.foo`

## Key Files

- `backend/app/core/config.py` — Pydantic Settings (all env vars)
- `backend/app/core/database.py` — Async engine + session factories
- `backend/app/core/deps.py` — FastAPI dependencies (auth, db, require_role)
- `backend/app/core/security.py` — JWT + bcrypt
- `backend/app/main.py` — App init + router registration (~76 endpoints)
- `backend/app/jobs/celery_app.py` — Celery config + beat schedule
- `backend/app/services/otp_service.py` — Mock OTP with Redis store
- `backend/app/services/pricing_service.py` — Pricing CRUD + price calculation with area fallback
- `backend/app/services/request_service.py` — Request lifecycle orchestration (create, accept, reject, listing)
- `backend/app/services/broadcast_service.py` — Vendor selection, broadcast rounds, accept/reject
- `backend/app/services/report_service.py` — Report upload, revision, download, publish validation
- **OCR Architecture:** `OcrProvider` (ABC) → `ClaudeOcrProvider` (implementation) → `OcrService` (orchestrator). Providers are swappable. Extracted data stored in `Report.content_json` (JSONB). Required fields for publish defined in `constants.REQUIRED_REPORT_FIELDS`.
- `backend/app/services/billing_service.py` — VendorEarning + LenderPayable creation
- `backend/app/api/lender/requests.py` — Lender request endpoints (6)
- `backend/app/api/vendor/requests.py` — Vendor request endpoints (6)
- `backend/app/api/admin/pricing.py` — Admin pricing API (5 endpoints)
- `backend/app/core/constants.py` — Broadcast, upload, polling constants
- `backend/scripts/seed.py` — Seed GTR admin + sample lender/vendor + pricing rules + service areas
- `frontend/src/lib/api.ts` — Typed API client (includes upload for multipart)
- `frontend/src/hooks/use-auth.ts` — Auth state management
- `frontend/src/hooks/use-polling.ts` — 30s polling for request notifications
- `backend/app/services/ocr/base.py` — OcrProvider ABC + ExtractionResult dataclass
- `backend/app/services/ocr/claude_provider.py` — Claude API vision extraction
- `backend/app/services/ocr/ocr_service.py` — OCR orchestration (provider → content_json)
- `backend/app/jobs/ocr_tasks.py` — Celery tasks for single + bulk OCR processing
- `backend/app/jobs/pdf_optimize.py` — PDF lossless compression with pikepdf
- `backend/app/api/vendor/reports.py` — Vendor report endpoints (bulk upload, edit, publish, retry, PDF)
- `backend/app/models/purchase.py` — ReportPurchase model (listing report purchases)
- `backend/app/services/listing_service.py` — Listing CRUD, PII redaction, browse, purchase
- `backend/app/api/vendor/listings.py` — Vendor listing endpoints (list/delist/browse)
- `backend/app/api/lender/listings.py` — Lender listing endpoints (browse/detail/purchase/download)
- `backend/app/models/notification.py` — Notification model (event-driven alerts)
- `backend/app/services/notification_service.py` — Notification CRUD (create, list, mark read, unread count)
- `backend/app/services/dashboard_service.py` — Aggregation queries for all dashboards (13 functions)
- `backend/app/services/csv_export_service.py` — Streaming CSV response generator
- `backend/app/api/notifications.py` — Notification endpoints (list, unread count, mark read)
- `backend/app/api/vendor/dashboard.py` — Vendor dashboard endpoints (5)
- `backend/app/api/lender/dashboard.py` — Lender dashboard endpoints (3)
- `backend/app/api/admin/dashboard.py` — Admin dashboard endpoints (8, incl. 3 CSV exports)
- `backend/app/models/template.py` — ReportTemplate model (config_json JSONB)
- `backend/app/services/template_service.py` — Template CRUD + logo upload
- `backend/app/services/pdf_render_service.py` — Jinja2 + WeasyPrint PDF rendering with caching
- `backend/app/api/lender/templates.py` — Lender template endpoints (8)
- `backend/app/templates/report_master.html` — Jinja2 HTML master template for PDF output
- `backend/app/api/vendor/map.py` — Vendor coverage map endpoint (own reports + competitor areas)
- `frontend/src/app/vendor/map/page.tsx` — Vendor coverage map page
- `frontend/src/app/lender/listings/_components/listings-map.tsx` — Lender listings map component
- `backend/app/core/ws_manager.py` — WebSocket connection manager + Redis pub/sub
- `backend/app/api/ws_notifications.py` — WebSocket notification endpoint
- `backend/app/models/activity_log.py` — ActivityLog model (audit trail)
- `backend/app/services/activity_log_service.py` — Activity log write + query
- `backend/app/services/notification_preference_service.py` — Preference CRUD
- `backend/app/api/admin/activity.py` — Admin activity log API + CSV export
- `frontend/src/contexts/websocket-provider.tsx` — WebSocket context provider
- `backend/app/models/push_subscription.py` — PushSubscription model (per-device push)
- `backend/app/services/push_service.py` — Web Push send via pywebpush + VAPID
- `backend/app/api/push.py` — Push API endpoints (subscribe/unsubscribe/vapid-key)
- `frontend/src/sw.ts` — Service worker with push + notificationclick handlers
- `frontend/src/hooks/use-push-subscription.ts` — Push subscription management hook
- `backend/app/api/admin/billing.py` — Admin billing API (6 endpoints)
- `backend/app/api/vendor/billing.py` — Vendor billing entries + CSV export
- `backend/app/api/lender/billing.py` — Lender billing entries + CSV export
- `backend/app/jobs/billing_tasks.py` — Monthly invoice generation Celery task
- `frontend/src/app/admin/billing/page.tsx` — Admin billing page
- `backend/app/models/system_config.py` — SystemConfig model (global platform params)
- `backend/app/models/vendor_config.py` — VendorConfig + VendorLenderExclusion models
- `backend/app/models/lender_config.py` — LenderConfig + LenderVendorPreference models
- `backend/app/services/system_config_service.py` — System config CRUD + Redis cache
- `backend/app/services/vendor_config_service.py` — Vendor config + exclusion CRUD
- `backend/app/services/lender_config_service.py` — Lender config + vendor preferences
- `backend/app/api/admin/system_config.py` — Admin system config endpoints
- `frontend/src/app/admin/settings/page.tsx` — Admin system config page
- `backend/app/models/vendor_profile.py` — VendorProfile (quality score, tier) + VendorRating models
- `backend/app/services/vendor_profile_service.py` — Profile CRUD, quality score calculation, tier promotion
- `backend/app/services/vendor_rating_service.py` — Rating CRUD + aggregation
- `backend/app/api/vendor/profile.py` — Vendor profile endpoints (4: view/edit/photo/tier)
- `backend/app/api/lender/vendors.py` — Lender vendor endpoints (4: profile/portfolio/rate/ratings)
- `backend/app/api/admin/vendor_tiers.py` — Admin tier override endpoint
- `frontend/src/components/tier-badge.tsx` — Reusable tier badge (NEW/VERIFIED/TOP_VALUER)
- `frontend/src/components/rating-stars.tsx` — Star rating display + interactive input
- `frontend/src/components/rating-modal.tsx` — Post-acceptance rating dialog
- `backend/app/models/locality.py` — Locality model (name, pin_code, city, lat/lng)
- `backend/app/services/marketplace_service.py` — Unified search (reports + vendors), geo-bounds, autocomplete
- `backend/app/api/marketplace/search.py` — Marketplace endpoints (search, map-bounds, autocomplete)
- `frontend/src/app/lender/marketplace/page.tsx` — Split-view marketplace page
- `backend/app/models/price_band.py` — PriceBand + VendorPricing models
- `backend/app/services/price_band_service.py` — Price band CRUD + vendor pricing with band validation
- `backend/app/api/admin/price_bands.py` — Admin price band endpoints (3)
- `backend/app/api/vendor/pricing.py` — Vendor self-pricing endpoints (2)
- `backend/app/models/quality_review.py` — QualityReview model (GTR quality gate)
- `backend/app/services/quality_review_service.py` — Review queue, decisions, report status updates
- `backend/app/api/admin/quality_reviews.py` — Admin quality review endpoints (3)
- `backend/app/jobs/tier_tasks.py` — Celery tasks for tier demotion + warnings
- `backend/scripts/seed_localities.py` — Seed 30 localities across 4 metros
- `docker-compose.local.yml` — Local dev environment
- `.env.local` — Environment variables (ports, secrets, config)
- `ARCHITECTURE.md` — Full architecture design
- `MILESTONES.md` — Development phases and timeline (13 phases, ~20 weeks)
- `docs/superpowers/specs/` — Design specs for each phase
- `docs/superpowers/plans/` — Implementation plans for each phase
