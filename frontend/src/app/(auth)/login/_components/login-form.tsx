"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { LoginResponse } from "@/types/auth";
import { PortalSelector } from "./portal-selector";

type Tab = "email" | "mobile";
type OtpStep = "request" | "verify";

function getPortalPath(userType: string): string {
  if (userType === "LENDER") return "/lender/dashboard";
  if (userType === "VENDOR") return "/vendor/dashboard";
  return "/admin/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [tab, setTab] = useState<Tab>("email");
  const [otpStep, setOtpStep] = useState<OtpStep>("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dualRoleResponse, setDualRoleResponse] = useState<LoginResponse | null>(null);

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Mobile / OTP form state
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<LoginResponse>("/api/auth/login", { email, password });
      await login(response);
      if (response.is_dual_role) {
        setDualRoleResponse(response);
        return;
      }
      router.push(getPortalPath(response.user.user_type));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/login-otp", { mobile });
      setOtpStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<LoginResponse>("/api/auth/verify-otp", { mobile, otp });
      await login(response);
      if (response.is_dual_role) {
        setDualRoleResponse(response);
        return;
      }
      router.push(getPortalPath(response.user.user_type));
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (dualRoleResponse) {
    return <PortalSelector loginResponse={dualRoleResponse} />;
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
        <p className="mt-1 text-sm text-gray-500">
          Access your PropEval portal
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["email", "mobile"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(null); setOtpStep("request"); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "email" ? "Email" : "Mobile"}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Email Tab */}
      {tab === "email" && (
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <a href="#" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      {/* Mobile Tab */}
      {tab === "mobile" && otpStep === "request" && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile number
            </label>
            <input
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+91 98765 43210"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
          >
            {loading ? "Sending OTP…" : "Send OTP"}
          </button>
        </form>
      )}

      {tab === "mobile" && otpStep === "verify" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <p className="text-sm text-gray-600">
            OTP sent to <span className="font-medium">{mobile}</span>.{" "}
            <button
              type="button"
              onClick={() => { setOtpStep("request"); setOtp(""); setError(null); }}
              className="text-blue-600 hover:underline"
            >
              Change
            </button>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter OTP
            </label>
            <input
              type="text"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest text-center text-lg"
              placeholder="• • • • • •"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
          >
            {loading ? "Verifying…" : "Verify & Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
