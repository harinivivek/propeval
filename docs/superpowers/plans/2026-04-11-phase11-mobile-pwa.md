# Phase 11: Mobile PWA for Vendors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the vendor portal installable as a PWA with Web Push notifications for new broadcast requests.

**Architecture:** @serwist/next generates a service worker from the Next.js build for asset caching and push event handling. Backend uses pywebpush with VAPID keys to send push notifications. PushSubscription model stores per-device browser subscriptions. Broadcast service triggers push alongside existing WebSocket/notification delivery.

**Tech Stack:** @serwist/next (service worker), Web Push API (browser), pywebpush + VAPID (backend), Next.js manifest + meta tags.

---

## File Structure

### New Files (Backend — 4)
| File | Responsibility |
|------|---------------|
| `backend/app/models/push_subscription.py` | PushSubscription SQLAlchemy model |
| `backend/app/services/push_service.py` | Subscribe, unsubscribe, send push via pywebpush |
| `backend/app/schemas/push.py` | Pydantic schemas for push API |
| `backend/app/api/push.py` | Push API router (3 endpoints) |

### New Files (Frontend — 8)
| File | Responsibility |
|------|---------------|
| `frontend/public/manifest.json` | PWA manifest |
| `frontend/public/icons/icon-192.png` | App icon 192px |
| `frontend/public/icons/icon-512.png` | App icon 512px |
| `frontend/public/icons/badge-72.png` | Notification badge icon |
| `frontend/src/sw.ts` | Custom service worker with push handlers |
| `frontend/src/hooks/use-push-subscription.ts` | Push subscription management hook |
| `frontend/src/app/vendor/dashboard/_components/install-banner.tsx` | PWA install prompt banner |
| `frontend/src/app/vendor/dashboard/_components/notification-banner.tsx` | Notification permission banner |

### Modified Files (Backend — 5)
| File | Change |
|------|--------|
| `backend/pyproject.toml` | Add pywebpush dependency |
| `backend/app/core/config.py` | Add VAPID env vars |
| `backend/app/models/__init__.py` | Register PushSubscription |
| `backend/app/main.py` | Register push API router |
| `backend/app/services/broadcast_service.py` | Call push service on NEW_BROADCAST |

### Modified Files (Frontend — 3)
| File | Change |
|------|--------|
| `frontend/next.config.ts` | Add @serwist/next plugin |
| `frontend/src/app/layout.tsx` | Add manifest link + PWA meta tags |
| `frontend/src/app/vendor/dashboard/page.tsx` | Add install + notification banners |

### Migration
| File | Change |
|------|--------|
| `backend/alembic/versions/xxx_add_push_subscriptions.py` | Add push_subscriptions table |

---

## Task 1: Add PushSubscription Model and Migration

**Files:**
- Create: `backend/app/models/push_subscription.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create PushSubscription model**

Create `backend/app/models/push_subscription.py`:

```python
import uuid

from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class PushSubscription(BaseModel):
    __tablename__ = "push_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    endpoint: Mapped[str] = mapped_column(Text)
    p256dh: Mapped[str] = mapped_column(Text)
    auth: Mapped[str] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("endpoint", name="uq_push_subscription_endpoint"),
    )
```

- [ ] **Step 2: Register model in `__init__.py`**

Add to `backend/app/models/__init__.py`:

Import:
```python
from app.models.push_subscription import PushSubscription
```

Add to `__all__`:
```python
"PushSubscription",
```

- [ ] **Step 3: Generate and run migration**

Rebuild backend container (scripts/ and alembic/ are baked into image):
```bash
docker compose -f docker-compose.local.yml --env-file .env.local build backend
docker compose -f docker-compose.local.yml --env-file .env.local up -d --force-recreate backend
```

Generate migration:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic revision --autogenerate -m "add push_subscriptions table"
```

Copy to host:
```bash
docker cp propeval-backend-1:/app/alembic/versions/<file>.py backend/alembic/versions/
```

Run migration:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/push_subscription.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat(phase11): add PushSubscription model and migration"
```

---

## Task 2: Add VAPID Config and Push Schemas

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/pyproject.toml`
- Create: `backend/app/schemas/push.py`

- [ ] **Step 1: Add VAPID env vars to config.py**

Add these fields to the `Settings` class in `backend/app/core/config.py`, after the existing JWT config block (around line 40):

```python
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@getitright.com"
```

- [ ] **Step 2: Generate VAPID keys and add to .env.local**

Run inside the backend container (after adding pywebpush in Step 3):
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend python -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print('VAPID_PRIVATE_KEY=' + v.private_pem())
print('VAPID_PUBLIC_KEY=' + v.public_key_urlsafe_base64())
"
```

Alternatively, generate with openssl and encode manually. Add the output keys to `.env.local`.

NOTE: If py_vapid is not available yet, defer this step until after pywebpush is installed in Step 3. You can also use this simpler approach:

```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend python -c "
from pywebpush import webpush
import json
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

private_key = ec.generate_private_key(ec.SECP256R1())
private_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
public_bytes = private_key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)

print('VAPID_PRIVATE_KEY=' + base64.urlsafe_b64encode(private_bytes).decode().rstrip('='))
print('VAPID_PUBLIC_KEY=' + base64.urlsafe_b64encode(public_bytes).decode().rstrip('='))
"
```

Add the generated keys to `.env.local`.

- [ ] **Step 3: Add pywebpush to backend dependencies**

Add to the `[tool.poetry.dependencies]` section of `backend/pyproject.toml`:

```toml
pywebpush = ">=2.0.0"
```

Then regenerate the lock file:
```bash
cd backend && poetry lock
```

Rebuild the backend container:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local build backend
docker compose -f docker-compose.local.yml --env-file .env.local up -d --force-recreate backend
```

- [ ] **Step 4: Create push schemas**

Create `backend/app/schemas/push.py`:

```python
from pydantic import BaseModel


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class VapidKeyResponse(BaseModel):
    public_key: str
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/pyproject.toml backend/poetry.lock backend/app/schemas/push.py
git commit -m "feat(phase11): add VAPID config, pywebpush dependency, and push schemas"
```

---

## Task 3: Add Push Service

**Files:**
- Create: `backend/app/services/push_service.py`

- [ ] **Step 1: Create the push service**

Create `backend/app/services/push_service.py`:

```python
import logging
import uuid

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


async def subscribe(
    db: AsyncSession,
    user_id: uuid.UUID,
    endpoint: str,
    p256dh: str,
    auth: str,
) -> None:
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.user_id = user_id
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
        )
        db.add(sub)
    await db.flush()


async def unsubscribe(db: AsyncSession, endpoint: str) -> None:
    await db.execute(
        delete(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    await db.flush()


async def send_push_to_users(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    title: str,
    body: str,
    url: str = "/vendor/requests",
) -> None:
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys not configured, skipping push")
        return

    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id.in_(user_ids)
        )
    )
    subscriptions = result.scalars().all()

    import json

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icons/icon-192.png",
        "badge": "/icons/badge-72.png",
        "data": {"url": url},
    })

    dead_endpoints = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                dead_endpoints.append(sub.endpoint)
            else:
                logger.exception("Push failed for endpoint %s", sub.endpoint[:50])
        except Exception:
            logger.exception("Push failed for endpoint %s", sub.endpoint[:50])

    if dead_endpoints:
        await db.execute(
            delete(PushSubscription).where(
                PushSubscription.endpoint.in_(dead_endpoints)
            )
        )
        await db.flush()
        logger.info("Cleaned %d dead push subscriptions", len(dead_endpoints))
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/push_service.py
git commit -m "feat(phase11): add push notification service with pywebpush"
```

---

## Task 4: Add Push API Endpoints and Register Router

**Files:**
- Create: `backend/app/api/push.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create push API router**

Create `backend/app/api/push.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.push import (
    PushSubscribeRequest,
    PushUnsubscribeRequest,
    VapidKeyResponse,
)
from app.services import push_service

router = APIRouter(
    prefix="/api/push",
    tags=["push"],
)


@router.get("/vapid-key", response_model=VapidKeyResponse)
async def get_vapid_key(
    current_user=Depends(get_current_user),
):
    return VapidKeyResponse(public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe")
async def subscribe(
    body: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await push_service.subscribe(
        db,
        user_id=current_user.id,
        endpoint=body.endpoint,
        p256dh=body.keys.p256dh,
        auth=body.keys.auth,
    )
    return {"status": "subscribed"}


@router.post("/unsubscribe")
async def unsubscribe(
    body: PushUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await push_service.unsubscribe(db, body.endpoint)
    return {"status": "unsubscribed"}
```

- [ ] **Step 2: Register router in main.py**

Add import to `backend/app/main.py`:

```python
from app.api.push import router as push_router
```

Add registration alongside existing routers:

```python
app.include_router(push_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/push.py backend/app/main.py
git commit -m "feat(phase11): add push API endpoints and register router"
```

---

## Task 5: Integrate Push with Broadcast Service

**Files:**
- Modify: `backend/app/services/broadcast_service.py`

- [ ] **Step 1: Add push calls to broadcast service**

Read `backend/app/services/broadcast_service.py` first to find the exact locations.

Add import at top:

```python
from app.services import push_service
```

After the first `create_notification` loop in `start_broadcast` (around line 126, after the notification loop and activity log), add:

```python
    await push_service.send_push_to_users(
        db,
        user_ids=vendor_user_ids,
        title="New Request Available",
        body=f"{request.report_category.value} report request",
        url="/vendor/requests",
    )
```

After the second `create_notification` loop in `advance_broadcast_round` (around line 201, after the notification loop and activity log), add the same push call:

```python
    await push_service.send_push_to_users(
        db,
        user_ids=vendor_user_ids,
        title="New Request Available",
        body=f"{request.report_category.value} report request",
        url="/vendor/requests",
    )
```

IMPORTANT: Read the file to find the actual variable names for vendor user IDs and request details. The variable holding vendor user IDs may be named differently (e.g., `batch_user_ids`, `user_ids_to_notify`). Use whatever variable the existing notification loop iterates over.

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/broadcast_service.py
git commit -m "feat(phase11): integrate push notifications with broadcast service"
```

---

## Task 6: Install Frontend Dependencies, Create Manifest and Icons

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/icons/icon-192.png`
- Create: `frontend/public/icons/icon-512.png`
- Create: `frontend/public/icons/badge-72.png`

- [ ] **Step 1: Install @serwist/next and serwist**

```bash
cd frontend && npm install @serwist/next serwist
```

Also install inside the Docker container if frontend runs in Docker:
```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec frontend npm install @serwist/next serwist
```

- [ ] **Step 2: Create manifest.json**

Create `frontend/public/manifest.json`:

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
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Create placeholder icons**

Create `frontend/public/icons/` directory and generate simple placeholder PNG icons. Use a script or canvas approach:

```bash
mkdir -p frontend/public/icons
```

Generate icons using Python (run on host or in backend container with Pillow):

```bash
docker compose -f docker-compose.local.yml --env-file .env.local exec backend python -c "
from PIL import Image, ImageDraw, ImageFont
import io

def make_icon(size, text='PE'):
    img = Image.new('RGB', (size, size), '#2563eb')
    draw = ImageDraw.Draw(img)
    font_size = size // 3
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size)
    except:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2), text, fill='white', font=font)
    return img

make_icon(192).save('/app/icon-192.png')
make_icon(512).save('/app/icon-512.png')
make_icon(72).save('/app/icon-72.png')
print('Icons generated')
"
docker cp propeval-backend-1:/app/icon-192.png frontend/public/icons/icon-192.png
docker cp propeval-backend-1:/app/icon-512.png frontend/public/icons/icon-512.png
docker cp propeval-backend-1:/app/icon-72.png frontend/public/icons/badge-72.png
```

If Pillow is not available, create minimal 1-pixel PNGs as placeholders (they'll still pass PWA installability checks):

```bash
# Fallback: create minimal valid PNGs using Python base64
python3 -c "
import base64, struct, zlib

def make_png(size, r, g, b):
    raw = b''
    for _ in range(size):
        raw += b'\x00' + bytes([r, g, b]) * size
    compressed = zlib.compress(raw)
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')

open('frontend/public/icons/icon-192.png', 'wb').write(make_png(192, 37, 99, 235))
open('frontend/public/icons/icon-512.png', 'wb').write(make_png(512, 37, 99, 235))
open('frontend/public/icons/badge-72.png', 'wb').write(make_png(72, 37, 99, 235))
print('Icons created')
"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/public/manifest.json frontend/public/icons/ frontend/package.json frontend/package-lock.json
git commit -m "feat(phase11): add PWA manifest, icons, and @serwist/next dependency"
```

---

## Task 7: Create Service Worker and Update Next.js Config

**Files:**
- Create: `frontend/src/sw.ts`
- Modify: `frontend/next.config.ts`

- [ ] **Step 1: Create custom service worker**

Create `frontend/src/sw.ts`:

```typescript
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "PropEval", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/badge-72.png",
      data: { url: data.data?.url || "/vendor/requests" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/vendor/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

serwist.addEventListeners();
```

- [ ] **Step 2: Update next.config.ts**

Replace `frontend/next.config.ts` with:

```typescript
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withSerwist(nextConfig);
```

Note: `disable: process.env.NODE_ENV === "development"` prevents the service worker from running in dev mode where it interferes with hot reload.

- [ ] **Step 3: Add `sw.js` to .gitignore if not already**

The generated `public/sw.js` should not be committed. Check if `frontend/.gitignore` already ignores it, if not add:

```
/public/sw.js
/public/swe-worker-*.js
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/sw.ts frontend/next.config.ts frontend/.gitignore
git commit -m "feat(phase11): add service worker with push handlers and @serwist/next config"
```

---

## Task 8: Update Root Layout with PWA Metadata

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Add PWA meta tags to root layout**

Read `frontend/src/app/layout.tsx`. The current file has a basic `metadata` export and a `<html>` with `<body>`. Add the manifest link and PWA meta tags.

Update the `metadata` export to include PWA fields:

```typescript
export const metadata: Metadata = {
  title: "PropEval",
  description: "Property valuation and legal reports marketplace",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PropEval",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};
```

Also add an icon link in the metadata:

```typescript
export const metadata: Metadata = {
  // ... existing fields above
  icons: {
    apple: "/icons/icon-192.png",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat(phase11): add PWA metadata to root layout"
```

---

## Task 9: Add Push Subscription Hook

**Files:**
- Create: `frontend/src/hooks/use-push-subscription.ts`

- [ ] **Step 1: Create the push subscription hook**

Create `frontend/src/hooks/use-push-subscription.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subscribingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (subscribingRef.current) return;
    subscribingRef.current = true;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        subscribingRef.current = false;
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const vapidRes = await api.get<{ public_key: string }>("/api/push/vapid-key");
      const applicationServerKey = urlBase64ToUint8Array(vapidRes.public_key);

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJson = subscription.toJSON();
      await api.post("/api/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh || "",
          auth: subJson.keys?.auth || "",
        },
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      subscribingRef.current = false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        try {
          await api.post("/api/push/unsubscribe", { endpoint });
        } catch {
          // Best effort — user may be logging out
        }
        setIsSubscribed(false);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (permission === "granted" && !isSubscribed && "serviceWorker" in navigator) {
      const checkExisting = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            setIsSubscribed(true);
            const subJson = subscription.toJSON();
            await api.post("/api/push/subscribe", {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh || "",
                auth: subJson.keys?.auth || "",
              },
            });
          }
        } catch {
          // silent
        }
      };
      checkExisting();
    }
  }, [permission, isSubscribed]);

  return { permission, isSubscribed, subscribe, unsubscribe };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/use-push-subscription.ts
git commit -m "feat(phase11): add push subscription management hook"
```

---

## Task 10: Add Install Banner Component

**Files:**
- Create: `frontend/src/app/vendor/dashboard/_components/install-banner.tsx`

- [ ] **Step 1: Create the install banner**

Create `frontend/src/app/vendor/dashboard/_components/install-banner.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (isStandalone) return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince =
        (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    deferredPromptRef.current = null;
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          +
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-900">Install PropEval</p>
          <p className="text-xs text-blue-600">Add to your home screen for quick access</p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleDismiss}
          className="text-sm text-gray-500 px-2 py-1"
        >
          Later
        </button>
        <button
          onClick={handleInstall}
          className="text-sm bg-blue-600 text-white rounded-md px-4 py-1.5 font-medium hover:bg-blue-700"
        >
          Install
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/vendor/dashboard/_components/install-banner.tsx
git commit -m "feat(phase11): add PWA install banner component"
```

---

## Task 11: Add Notification Permission Banner Component

**Files:**
- Create: `frontend/src/app/vendor/dashboard/_components/notification-banner.tsx`

- [ ] **Step 1: Create the notification banner**

Create `frontend/src/app/vendor/dashboard/_components/notification-banner.tsx`:

```tsx
"use client";

import { usePushSubscription } from "@/hooks/use-push-subscription";

export function NotificationBanner() {
  const { permission, subscribe } = usePushSubscription();

  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }

  if (permission === "granted") {
    return null;
  }

  if (permission === "denied") {
    return (
      <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          !
        </div>
        <div>
          <p className="text-sm font-semibold text-red-900">Notifications Blocked</p>
          <p className="text-xs text-red-600">
            You may miss new requests. Go to browser settings &rarr; Site settings &rarr; Notifications to enable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0">
          &#x1f514;
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-900">Enable Notifications</p>
          <p className="text-xs text-amber-700">Get alerts when new requests are available</p>
        </div>
      </div>
      <button
        onClick={subscribe}
        className="text-sm bg-amber-500 text-white rounded-md px-4 py-1.5 font-medium hover:bg-amber-600 flex-shrink-0"
      >
        Enable
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/vendor/dashboard/_components/notification-banner.tsx
git commit -m "feat(phase11): add notification permission banner component"
```

---

## Task 12: Integrate Banners into Vendor Dashboard

**Files:**
- Modify: `frontend/src/app/vendor/dashboard/page.tsx`

- [ ] **Step 1: Add banners to vendor dashboard**

Read `frontend/src/app/vendor/dashboard/page.tsx`. Add the banner imports at the top:

```typescript
import { InstallBanner } from "./_components/install-banner";
import { NotificationBanner } from "./_components/notification-banner";
```

Add the banners at the very top of the returned JSX, before the existing dashboard heading:

```tsx
return (
  <div>
    <InstallBanner />
    <NotificationBanner />
    <h1 className="text-2xl font-bold mb-6">Vendor Dashboard</h1>
    {/* ... existing dashboard content ... */}
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/vendor/dashboard/page.tsx
git commit -m "feat(phase11): integrate install and notification banners into vendor dashboard"
```

---

## Task 13: Update CLAUDE.md with Phase 11 Completion Status

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Current Status section**

Add Phase 11 entry after the Phase 10 line in the Current Status section of `CLAUDE.md`:

```markdown
**Phase 11 (Mobile PWA):** Complete — @serwist/next service worker with asset caching and push event handlers, PWA manifest with standalone display mode, Web Push notifications via VAPID + pywebpush (triggered on NEW_BROADCAST), PushSubscription model with per-device storage, push API (subscribe/unsubscribe/vapid-key), install banner on vendor dashboard (smart beforeinstallprompt with 7-day dismiss), notification permission banner (3 states: prompt/denied/granted)
```

Also add to the Key Files section:

```markdown
- `backend/app/models/push_subscription.py` — PushSubscription model (per-device push)
- `backend/app/services/push_service.py` — Web Push send via pywebpush + VAPID
- `backend/app/api/push.py` — Push API endpoints (subscribe/unsubscribe/vapid-key)
- `frontend/src/sw.ts` — Service worker with push + notificationclick handlers
- `frontend/src/hooks/use-push-subscription.ts` — Push subscription management hook
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(phase11): update CLAUDE.md with Phase 11 completion status"
```
