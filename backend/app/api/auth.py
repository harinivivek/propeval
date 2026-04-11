from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_token
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    OTPRequest,
    OTPVerifyRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import (
    authenticate_email,
    authenticate_otp,
    check_dual_role,
    generate_tokens,
    get_user_by_email,
    get_user_by_mobile,
    refresh_access_token,
    request_otp,
    reset_password,
)
from app.services.otp_service import send_otp
from app.services.activity_log_service import log_activity

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await authenticate_email(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    tokens = generate_tokens(user)
    is_dual = await check_dual_role(db, user)
    await log_activity(
        db,
        actor_id=user.id,
        actor_type=user.user_type.value,
        action="USER_LOGIN",
        target_type="USER",
        target_id=user.id,
        ip_address=request.client.host if request.client else None,
    )
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=UserResponse.model_validate(user),
        is_dual_role=is_dual,
    )


@router.post("/login-otp", response_model=MessageResponse)
async def login_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    sent = await request_otp(db, body.mobile)
    if not sent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mobile not found")
    return MessageResponse(message="OTP sent successfully")


@router.post("/verify-otp", response_model=LoginResponse)
async def verify_otp_endpoint(body: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_otp(db, body.mobile, body.otp)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP")
    tokens = generate_tokens(user)
    is_dual = await check_dual_role(db, user)
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user=UserResponse.model_validate(user),
        is_dual_role=is_dual,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await refresh_access_token(db, body.refresh_token)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return TokenResponse(access_token=result["access_token"])


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = None
    if body.email:
        user = await get_user_by_email(db, body.email)
    elif body.mobile:
        user = await get_user_by_mobile(db, body.mobile)

    if not user:
        # Return success regardless to avoid user enumeration
        return MessageResponse(message="If an account exists, a reset link has been sent")

    # Generate a reset token (type=reset)
    from datetime import UTC, datetime, timedelta
    from jose import jwt
    from app.core.config import settings

    expire = datetime.now(UTC) + timedelta(minutes=30)
    reset_token = jwt.encode(
        {"sub": str(user.id), "type": "reset", "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    if body.mobile:
        await send_otp(body.mobile)

    # In production, send email/SMS with reset_token
    import logging
    logging.getLogger(__name__).info(f"[MOCK] Reset token for user {user.id}: {reset_token}")

    return MessageResponse(message="If an account exists, a reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_endpoint(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    success = await reset_password(db, body.token, body.new_password)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    return MessageResponse(message="Password reset successfully")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
