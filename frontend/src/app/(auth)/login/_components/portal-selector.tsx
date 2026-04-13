"use client";
import type { LoginResponse } from "@/types/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="w-full max-w-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome, {user.full_name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You have access to multiple portals. Choose one to continue.
        </p>
      </div>
      <div className="space-y-3">
        {portals.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full justify-between py-6 text-base hover:border-primary hover:bg-primary/5 hover:text-primary"
            )}
          >
            <span className="font-medium">{label}</span>
            <span>&rarr;</span>
          </a>
        ))}
      </div>
    </div>
  );
}
