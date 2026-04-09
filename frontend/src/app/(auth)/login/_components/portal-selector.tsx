"use client";
import type { LoginResponse } from "@/types/auth";

interface PortalSelectorProps {
  loginResponse: LoginResponse;
}

export function PortalSelector({ loginResponse }: PortalSelectorProps) {
  const { user } = loginResponse;

  const portals: { label: string; href: string; type: string }[] = [
    { label: "Lender Portal", href: "/lender/dashboard", type: "LENDER" },
    { label: "Vendor Portal", href: "/vendor/dashboard", type: "VENDOR" },
    { label: "Admin Portal", href: "/admin/dashboard", type: "ADMIN" },
  ];

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome, {user.full_name}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          You have access to multiple portals. Choose one to continue.
        </p>
      </div>
      <div className="space-y-3">
        {portals.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            className="flex items-center justify-between w-full px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
          >
            <span className="font-medium text-gray-800 group-hover:text-blue-700">
              {label}
            </span>
            <span className="text-gray-400 group-hover:text-blue-500">→</span>
          </a>
        ))}
      </div>
    </div>
  );
}
