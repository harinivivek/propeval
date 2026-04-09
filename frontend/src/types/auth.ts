export interface LoginRequest {
  email: string;
  password: string;
}
export interface OTPRequest {
  mobile: string;
}
export interface OTPVerifyRequest {
  mobile: string;
  otp: string;
}
export interface UserResponse {
  id: string;
  email: string;
  mobile: string;
  full_name: string;
  user_type: "LENDER" | "VENDOR" | "ADMIN";
  is_active: boolean;
}
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserResponse;
  is_dual_role: boolean;
}
export interface TokenResponse {
  access_token: string;
  token_type: string;
}
