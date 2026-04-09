from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.admin.accounts import router as admin_accounts_router
from app.api.admin.pricing import router as admin_pricing_router
from app.api.auth import router as auth_router
from app.api.lender.settings import router as lender_settings_router
from app.api.vendor.settings import router as vendor_settings_router

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
app.include_router(lender_settings_router)
app.include_router(vendor_settings_router)
