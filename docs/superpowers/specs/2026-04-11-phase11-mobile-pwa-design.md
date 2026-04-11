# Phase 11: Mobile PWA for Vendors — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** PWA manifest + service worker, Web Push notifications with VAPID, install/permission banners on vendor dashboard

---

## 1. Overview

The vendor portal is already fully responsive and mobile-friendly (since Phase 1). Phase 11 adds Progressive Web App capabilities so vendors can install the app to their home screen and receive native push notifications for new broadcast requests — even when the browser is closed.

**What's included:**
1. PWA manifest + service worker (installable app shell with asset caching)
2. Web Push notifications via VAPID (no Firebase dependency)
3. Install banner on vendor dashboard (smart, dismissible)
4. Notification permission banner (prompt + blocked state warning)
5. Push subscription management (backend model + API + integration with broadcast service)

**What's NOT included:**
- Offline data caching / background sync (deferred)
- Push for non-broadcast events
- Lender/Admin PWA
- Custom branded app icons (placeholder icons used)
- App store listing

## 2. PWA Manifest & Service Worker

### 2.1 Manifest

`frontend/public/manifest.json`:

```json
{
  "name": "PropEval Vendor",
  "short_name": "PropEval",
  "description": "Property valuation and legal reports marketplace",
  "start_url": "/vendor/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- Linked from root layout via `<link rel="manifest" href="/manifest.json">`
- `display: standalone` — removes browser chrome when launched from home screen
- `start_url: /vendor/dashboard` — vendors land directly on their dashboard
- Theme color matches existing blue (#2563eb)

### 2.2 Icons

Two placeholder PNG icons in `frontend/public/icons/`:
- `icon-192.png` — 192x192, blue background with "PE" text
- `icon-512.png` — 512x512, same design
- `badge-72.png` — 72x72, small monochrome badge for notification tray

Generated programmatically or as simple placeholder files. Can be replaced with branded icons later.

### 2.3 Service Worker (via @serwist/next)

**Package:** `@serwist/next` — the actively maintained fork of next-pwa, compatible with Next.js 15 App Router.

**Responsibilities:**

1. **Static asset caching** — Precaches JS bundles, CSS, fonts, icons on install. Uses Workbox strategies under the hood.
2. **Push event listener** — Receives push payloads from backend, calls `self.registration.showNotification()`.
3. **Notification click handler** — `notificationclick` event opens the app to the URL specified in the push payload.
4. **Lifecycle management** — Install (precache), activate (clean old caches), fetch (network-first for API, cache-first for assets).

**Custom service worker additions** (beyond @serwist defaults):

```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/badge-72.png',
      data: { url: data.data?.url || '/vendor/requests' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

### 2.4 Next.js Configuration

Update `frontend/next.config.ts` to include the @serwist/next plugin:

```typescript
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist({
  output: "standalone",
});
```

### 2.5 Root Layout Metadata

Add to `frontend/src/app/layout.tsx`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2563eb" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

## 3. Web Push Notifications

### 3.1 VAPID Keys

Generated once via `pywebpush.generate_vapid_keypair()` or `vapid` CLI. Stored as environment variables:

- `VAPID_PRIVATE_KEY` — Server-side only, base64url-encoded
- `VAPID_PUBLIC_KEY` — Shared with frontend for subscription, base64url-encoded
- `VAPID_SUBJECT` — Contact email (e.g., `mailto:admin@getitright.com`)

Added to `.env.local` and `backend/app/core/config.py` Settings class.

### 3.2 PushSubscription Model

`backend/app/models/push_subscription.py`:

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK (BaseModel) |
| user_id | UUID | FK → users, indexed |
| endpoint | Text | Browser push endpoint URL, unique |
| p256dh | Text | Client public key (base64url) |
| auth | Text | Client auth secret (base64url) |
| created_at | DateTime | BaseModel |
| updated_at | DateTime | BaseModel |

Unique constraint on `endpoint` — same device can't register twice. Multiple devices per user supported.

### 3.3 Push Service

`backend/app/services/push_service.py`:

- `subscribe(db, user_id, endpoint, p256dh, auth)` — Upserts subscription by endpoint. If endpoint exists for a different user, update user_id (device changed hands).
- `unsubscribe(db, endpoint)` — Deletes subscription by endpoint.
- `send_push(db, user_id, title, body, url)` — Sends push to all subscriptions for user_id. Uses `pywebpush.webpush()` with VAPID credentials. Auto-deletes subscriptions that return 404/410 (expired/unsubscribed).
- `send_push_to_users(db, user_ids, title, body, url)` — Batch send to multiple users. Fire-and-forget — exceptions logged but don't propagate.

### 3.4 Push API

`backend/app/api/push.py`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/push/vapid-key` | Returns `{ public_key: "<base64url>" }` |
| POST | `/api/push/subscribe` | Body: `{ endpoint, keys: { p256dh, auth } }`. Upserts subscription. |
| DELETE | `/api/push/unsubscribe` | Body: `{ endpoint }`. Removes subscription. |

All endpoints require authentication via `get_current_user`.

### 3.5 Integration with Broadcast Service

In `backend/app/services/broadcast_service.py`, after the existing `create_notification()` calls for NEW_BROADCAST events, add:

```python
await push_service.send_push_to_users(
    db,
    user_ids=vendor_user_ids,
    title="New Request Available",
    body=f"{category} report request for {address}",
    url="/vendor/requests",
)
```

This is fire-and-forget — push failures are logged but don't block the broadcast.

### 3.6 Push Payload Format

```json
{
  "title": "New Request Available",
  "body": "Valuation report request for Koramangala, Bengaluru",
  "icon": "/icons/icon-192.png",
  "badge": "/icons/badge-72.png",
  "data": {
    "url": "/vendor/requests"
  }
}
```

## 4. Frontend Components

### 4.1 Push Subscription Hook

`frontend/src/hooks/use-push-subscription.ts`:

- On mount (in vendor layout): check if service worker is registered and push is supported
- If `Notification.permission === 'granted'`: subscribe via `pushManager.subscribe()` with VAPID public key, send subscription to `POST /api/push/subscribe`
- If permission changes (granted → denied or vice versa): update accordingly
- On logout: call `DELETE /api/push/unsubscribe`
- Returns: `{ permission, subscribe, isSubscribed }`

### 4.2 Install Banner

`frontend/src/app/vendor/dashboard/_components/install-banner.tsx`:

- Captures `beforeinstallprompt` event in a ref
- Only renders if: (1) event is available, (2) not already installed (check `display-mode: standalone`), (3) not dismissed in last 7 days (localStorage check)
- Blue banner with icon, "Install PropEval" title, "Add to your home screen" subtitle
- "Install" button calls `deferredPrompt.prompt()`
- "Later" button sets localStorage dismissal timestamp, hides banner

### 4.3 Notification Permission Banner

`frontend/src/app/vendor/dashboard/_components/notification-banner.tsx`:

Three states:
1. **Default** (permission = 'default'): Yellow banner — "Enable Notifications — Get alerts when new requests are available." Enable button triggers `Notification.requestPermission()`.
2. **Denied** (permission = 'denied'): Red banner — "Notifications Blocked — You may miss new requests. Go to browser settings → Site settings → Notifications to enable."
3. **Granted** (permission = 'granted'): Banner hidden.

Checks `Notification.permission` on mount and after any permission request.

### 4.4 Vendor Dashboard Integration

Both banners render at the top of the vendor dashboard page (`frontend/src/app/vendor/dashboard/page.tsx`), before the existing dashboard content. Stacked vertically if both are visible.

### 4.5 Unsubscribe on Logout

In the auth hook or logout flow, call `DELETE /api/push/unsubscribe` with the current subscription endpoint before clearing the token.

## 5. Infrastructure & Dependencies

### 5.1 New Dependencies

- **Backend:** `pywebpush >= 2.0.0` (includes py-vapid)
- **Frontend:** `@serwist/next >= 9.0.0`, `serwist >= 9.0.0`

### 5.2 Environment Variables

Added to `.env.local` and `config.py`:

```
VAPID_PRIVATE_KEY=<base64url-encoded private key>
VAPID_PUBLIC_KEY=<base64url-encoded public key>
VAPID_SUBJECT=mailto:admin@getitright.com
```

Keys generated once during setup via a helper script or `pywebpush` CLI.

### 5.3 Docker

No new containers. `pywebpush` is a Python library added to `pyproject.toml`. @serwist/next runs at build time only — generates the service worker file.

### 5.4 Security

- VAPID private key stays server-side only (never exposed to frontend)
- Push subscriptions are tied to authenticated users
- Service worker scoped to `/` (covers all vendor routes)
- Push payloads contain no sensitive data (title + address only, no PII)

## 6. Files to Create/Modify

### New Files (Backend — 4)
- `backend/app/models/push_subscription.py` — PushSubscription model
- `backend/app/services/push_service.py` — Push send/subscribe/unsubscribe
- `backend/app/schemas/push.py` — Pydantic schemas
- `backend/app/api/push.py` — Push API endpoints (3)

### New Files (Frontend — 7)
- `frontend/public/manifest.json` — PWA manifest
- `frontend/public/icons/icon-192.png` — App icon 192px
- `frontend/public/icons/icon-512.png` — App icon 512px
- `frontend/public/icons/badge-72.png` — Notification badge
- `frontend/src/sw.ts` — Custom service worker (push + notificationclick handlers)
- `frontend/src/hooks/use-push-subscription.ts` — Push subscription management hook
- `frontend/src/app/vendor/dashboard/_components/install-banner.tsx` — PWA install banner
- `frontend/src/app/vendor/dashboard/_components/notification-banner.tsx` — Notification permission banner

### Modified Files (Backend — 4)
- `backend/app/models/__init__.py` — Register PushSubscription
- `backend/app/main.py` — Register push API router
- `backend/app/core/config.py` — Add VAPID env vars
- `backend/app/services/broadcast_service.py` — Call push service on NEW_BROADCAST

### Modified Files (Frontend — 3)
- `frontend/next.config.ts` — Add @serwist/next plugin
- `frontend/src/app/layout.tsx` — Add manifest link, theme-color, apple meta tags
- `frontend/src/app/vendor/dashboard/page.tsx` — Add install + notification banners

### Migration
- Alembic migration for `push_subscriptions` table
