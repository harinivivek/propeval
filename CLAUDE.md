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

## Seed Data (local)

| Role | Email | Password |
|------|-------|----------|
| GTR Admin | admin@getitright.com | admin123 |
| Lender | lender@abcl.com | lender123 |
| Vendor | vendor@valuepro.com | vendor123 |

Run: `make seed` (or `docker compose exec backend python -m scripts.seed`)

Seed also creates 4 pricing rules for ABCL Bank (Bengaluru: residential/commercial valuation, residential legal, Koramangala area-specific) and 2 service areas for the seed vendor (valuation with 4 areas, city-wide legal).

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
- **Pricing area fallback:** PricingRule uses two unique constraints (one for rows WITH area, one partial index for rows WHERE area IS NULL) to support city+area exact match with fallback to city-level pricing
- **Decimal serialization:** Pydantic serializes `Decimal` fields as strings (e.g., `"2500.00"`). Frontend types use `string` for price fields accordingly

## Key Files

- `backend/app/core/config.py` — Pydantic Settings (all env vars)
- `backend/app/core/database.py` — Async engine + session factories
- `backend/app/core/deps.py` — FastAPI dependencies (auth, db, require_role)
- `backend/app/core/security.py` — JWT + bcrypt
- `backend/app/main.py` — App init + router registration (~40 endpoints)
- `backend/app/jobs/celery_app.py` — Celery config + beat schedule
- `backend/app/services/otp_service.py` — Mock OTP with Redis store
- `backend/app/services/pricing_service.py` — Pricing CRUD + price calculation with area fallback
- `backend/app/services/request_service.py` — Request lifecycle orchestration (create, accept, reject, listing)
- `backend/app/services/broadcast_service.py` — Vendor selection, broadcast rounds, accept/reject
- `backend/app/services/report_service.py` — Report upload, revision, download
- `backend/app/services/billing_service.py` — VendorEarning + LenderPayable creation
- `backend/app/api/lender/requests.py` — Lender request endpoints (6)
- `backend/app/api/vendor/requests.py` — Vendor request endpoints (6)
- `backend/app/api/admin/pricing.py` — Admin pricing API (5 endpoints)
- `backend/app/core/constants.py` — Broadcast, upload, polling constants
- `backend/scripts/seed.py` — Seed GTR admin + sample lender/vendor + pricing rules + service areas
- `frontend/src/lib/api.ts` — Typed API client (includes upload for multipart)
- `frontend/src/hooks/use-auth.ts` — Auth state management
- `frontend/src/hooks/use-polling.ts` — 30s polling for request notifications
- `docker-compose.local.yml` — Local dev environment
- `.env.local` — Environment variables (ports, secrets, config)
- `ARCHITECTURE.md` — Full architecture design
- `MILESTONES.md` — Development phases and timeline (13 phases, ~20 weeks)
- `docs/superpowers/specs/` — Design specs for each phase
- `docs/superpowers/plans/` — Implementation plans for each phase
