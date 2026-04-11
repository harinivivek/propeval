from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
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

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Property Valuation & Legal Reports Marketplace",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
