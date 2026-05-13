from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.rate_limit import limiter
from app.api.admin.accounts import router as admin_accounts_router
from app.api.admin.pricing import router as admin_pricing_router
from app.api.auth import router as auth_router
from app.api.common.download import router as download_router
from app.api.common.polling import router as polling_router
from app.api.lender.requests import router as lender_requests_router
from app.api.lender.settings import router as lender_settings_router
from app.api.vendor.listings import router as vendor_listings_router
from app.api.vendor.reports import router as vendor_reports_router
from app.api.vendor.requests import router as vendor_requests_router
from app.api.vendor.settings import router as vendor_settings_router
from app.api.lender.listings import router as lender_listings_router
from app.api.notifications import router as notifications_router
from app.api.vendor.dashboard import router as vendor_dashboard_router
from app.api.lender.dashboard import router as lender_dashboard_router
from app.api.admin.dashboard import router as admin_dashboard_router
from app.api.lender.templates import router as lender_templates_router
from app.api.vendor.map import router as vendor_map_router
from app.api.ws_notifications import router as ws_notifications_router
from app.api.admin.activity import router as admin_activity_router
from app.api.push import router as push_router
from app.api.admin.billing import router as admin_billing_router
from app.api.vendor.billing import router as vendor_billing_router
from app.api.lender.billing import router as lender_billing_router
from app.api.admin.system_config import router as admin_system_config_router
from app.api.vendor.config import router as vendor_config_router
from app.api.lender.config import router as lender_config_router
from app.core.ws_manager import ws_manager

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Property Valuation & Legal Reports Marketplace",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware to handle Chrome's Private Network Access preflights
@app.middleware("http")
async def add_private_network_control_headers(request: Request, call_next):
    if request.method == "OPTIONS" and request.headers.get("access-control-request-private-network"):
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response
    return await call_next(request)

# CORS
allowed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

_cors_kwargs: dict = {
    "allow_origins": allowed_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
    "expose_headers": ["*"],
}
# Local dev: allow common LAN origins (e.g. http://192.168.x.x:3020) without editing env
if settings.APP_ENV == "local" and settings.DEBUG:
    _cors_kwargs["allow_origin_regex"] = (
        r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"
        r"|^https?://(192\.168(\.\d{1,3}){2}|10(\.\d{1,3}){3})(:\d+)?$"
    )

app.add_middleware(
    CORSMiddleware,
    **_cors_kwargs,
)


@app.on_event("startup")
async def startup_event():
    await ws_manager.start_subscriber()


@app.on_event("shutdown")
async def shutdown_event():
    await ws_manager.shutdown()


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}


app.include_router(auth_router)
app.include_router(admin_accounts_router)
app.include_router(admin_pricing_router)
app.include_router(download_router)
app.include_router(polling_router)
app.include_router(lender_requests_router)
app.include_router(lender_settings_router)
app.include_router(vendor_listings_router)
app.include_router(vendor_reports_router)
app.include_router(vendor_requests_router)
app.include_router(vendor_settings_router)
app.include_router(lender_listings_router)
app.include_router(notifications_router)
app.include_router(vendor_dashboard_router)
app.include_router(lender_dashboard_router)
app.include_router(admin_dashboard_router)
app.include_router(lender_templates_router)
app.include_router(vendor_map_router)
app.include_router(ws_notifications_router)
app.include_router(admin_activity_router)
app.include_router(push_router)
app.include_router(admin_billing_router)
app.include_router(vendor_billing_router)
app.include_router(lender_billing_router)
app.include_router(admin_system_config_router)
app.include_router(vendor_config_router)
app.include_router(lender_config_router)
