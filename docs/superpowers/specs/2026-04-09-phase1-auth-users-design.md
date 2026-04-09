# Phase 1: Auth, Users & Account Management — Design Spec

## Overview

Implement authentication, user/org domain models, RBAC, and account management for all three portals (Lender, Vendor, Admin/GTR).

## 1A: Core Auth

### New Models

**Lender domain:**
- `Lender` — id, org_id (FK organizations), name, city
- `LenderBranch` — id, lender_id (FK lenders), name, city
- `LenderUser` — id, user_id (FK users), lender_id (FK lenders), branch_ids (UUID[]), role (LenderRole enum)

**Vendor domain:**
- `Vendor` — id, org_id (FK organizations), name, office_city, office_area, services (ServiceType[])
- `VendorUser` — id, user_id (FK users), vendor_id (FK vendors), role (VendorRole enum)
- `ServiceArea` — id, vendor_id (FK vendors), city, areas (text[]), service_type (ServiceType enum)

### Auth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Email + password login → JWT access + refresh tokens |
| `/api/auth/login-otp` | POST | Request OTP for mobile number |
| `/api/auth/verify-otp` | POST | Verify OTP → JWT tokens |
| `/api/auth/refresh` | POST | Refresh token → new access token |
| `/api/auth/forgot-password` | POST | Send password reset (email or mobile) |
| `/api/auth/reset-password` | POST | Reset password with token |
| `/api/auth/me` | GET | Current user profile with type + roles |

### Mock OTP

- Store OTP in Redis: key `otp:{mobile}`, value `{code}`, TTL 5 minutes
- Log OTP to console/stdout instead of sending SMS
- Fixed dev OTP `123456` always accepted in local/dev environments

### Login Response

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "id": "uuid",
    "email": "...",
    "full_name": "...",
    "user_type": "LENDER|VENDOR|ADMIN",
    "is_dual_role": false
  }
}
```

Dual-role users (registered as both lender and vendor, i.e. GTR users) get `is_dual_role: true` → frontend shows portal selector.

### Login UI

Split-screen layout:
- **Left panel**: Brand color background, PropEval logo, tagline ("Property Valuation & Legal Reports Marketplace"), decorative illustration
- **Right panel**: Login form with tabs — "Email" | "Mobile"
  - Email tab: email input, password input, "Forgot password?" link, submit button
  - Mobile tab: mobile input, "Send OTP" button → OTP input field, verify button
- After login: redirect based on `user_type` (or show portal selector if dual-role)

## 1B: RBAC & Account Management

### Permission System

- `require_role(*roles)` — already exists in deps.py, checks user_type
- Add `require_page_access(page_key)` — checks UserRole against page permission map
- Page registry: dict mapping page keys to allowed roles

### Admin Account Management APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/lenders` | GET/POST | List/create lender accounts |
| `/api/admin/lenders/{id}` | GET/PUT | Get/update lender |
| `/api/admin/lenders/{id}/branches` | GET/POST | Manage branches |
| `/api/admin/lenders/{id}/users` | GET/POST | Manage lender users |
| `/api/admin/vendors` | GET/POST | List/create vendor accounts |
| `/api/admin/vendors/{id}` | GET/PUT | Get/update vendor |
| `/api/admin/vendors/{id}/users` | GET/POST | Manage vendor users |
| `/api/admin/vendors/{id}/service-areas` | GET/POST | Manage service areas |

### Lender Settings APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/lender/settings/users` | GET/POST | List/add users in own org |
| `/api/lender/settings/users/{id}` | PUT/DELETE | Update/remove user |

### Vendor Settings APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vendor/settings/users` | GET/POST | List/add users in own org |
| `/api/vendor/settings/users/{id}` | PUT/DELETE | Update/remove user |

### Admin UI Pages

- `/admin/accounts/lenders` — table of lenders, create/edit forms
- `/admin/accounts/vendors` — table of vendors, create/edit forms

### Lender/Vendor Settings Pages

- `/lender/settings` — manage users (name, email, mobile, role, branch assignment)
- `/vendor/settings` — manage users (name, email, mobile, role)

### Seed Script

- Creates GTR admin org + admin user
- Email: `admin@getitright.com`, password: `admin123` (local only)
- Creates sample lender org + user and vendor org + user for testing

## Implementation Order

1. Lender/Vendor models + migration
2. Auth schemas (request/response)
3. Auth service (login, OTP, JWT, password reset)
4. Auth router + register in main.py
5. Auth frontend (split-screen login page)
6. Admin account management (schemas → services → routers → UI)
7. Lender/Vendor settings (schemas → services → routers → UI)
8. Seed script
9. Tests
