from pydantic import BaseModel

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    email: str
    password: str


class OTPRequest(BaseModel):
    mobile: str


class OTPVerifyRequest(BaseModel):
    mobile: str
    otp: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str | None = None
    mobile: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    is_dual_role: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
