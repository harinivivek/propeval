"use client";

import { cn } from "@/lib/utils";

const tierConfig = {
  NEW: { label: "New", color: "bg-gray-100 text-gray-700 border-gray-300", icon: "+" },
  VERIFIED: { label: "Verified", color: "bg-blue-100 text-blue-700 border-blue-300", icon: "\u2713" },
  TOP_VALUER: { label: "Top Valuer", color: "bg-amber-100 text-amber-700 border-amber-300", icon: "\u2605" },
};

interface TierBadgeProps {
  tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TierBadge({ tier, size = "md", className }: TierBadgeProps) {
  const config = tierConfig[tier] || tierConfig.NEW;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
