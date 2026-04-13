"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { LoginResponse } from "@/types/auth";
import { PortalSelector } from "./portal-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
        <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Access your PropEval portal
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["email", "mobile"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(null); setOtpStep("request"); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "email" ? "Email" : "Mobile"}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Email Tab */}
      {tab === "email" && (
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a href="#" className="text-xs text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in\u2026" : "Sign in"}
          </Button>
        </form>
      )}

      {/* Mobile Tab */}
      {tab === "mobile" && otpStep === "request" && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending OTP\u2026" : "Send OTP"}
          </Button>
        </form>
      )}

      {tab === "mobile" && otpStep === "verify" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            OTP sent to <span className="font-medium text-foreground">{mobile}</span>.{" "}
            <button
              type="button"
              onClick={() => { setOtpStep("request"); setOtp(""); setError(null); }}
              className="text-primary hover:underline"
            >
              Change
            </button>
          </p>
          <div className="space-y-2">
            <Label htmlFor="otp">Enter OTP</Label>
            <Input
              id="otp"
              type="text"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              className="tracking-widest text-center text-lg"
              placeholder="• • • • • •"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Verifying\u2026" : "Verify & Sign in"}
          </Button>
        </form>
      )}
    </div>
  );
}
