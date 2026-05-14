"""Normalize collection URLs when the dev proxy strips trailing slashes.

Next.js (default trailingSlash: false) redirects ``/api/.../`` to ``/api/...``
before the request reaches the backend. FastAPI then 307-redirects back to the
canonical path with a trailing slash, building ``Location`` from the Host the
ASGI app saw (e.g. ``backend:8000`` inside Docker). The browser cannot resolve
that host, so fetch surfaces a network error.

Rewriting these collection roots to include a trailing slash before routing
avoids the redirect entirely. See lender POST /api/lender/requests via Next.
"""

from starlette.middleware.base import BaseHTTPMiddleware

# Paths registered as ``@router.get("/")`` / ``@router.post("/")`` under the
# given APIRouter prefix (full path ends with ``/`` in the route table).
_PROXY_STRIPPED_COLLECTIONS = frozenset(
    {
        "/api/lender/requests",
        "/api/lender/templates",
        "/api/vendor/requests",
        "/api/vendor/listings",
        "/api/lender/listings",
        "/api/admin/activity",
        "/api/notifications",
        "/api/vendor/map",
    }
)


class ProxyCollectionTrailingSlashMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.scope.get("path") or ""
        if path in _PROXY_STRIPPED_COLLECTIONS:
            request.scope["path"] = path + "/"
        return await call_next(request)
