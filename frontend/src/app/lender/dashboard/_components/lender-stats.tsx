"use client";

import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle, ShoppingCart, Send } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { LenderDashboardStats } from "@/types/dashboard";

export function LenderStats() {
  const [stats, setStats] = useState<LenderDashboardStats | null>(null);

  useEffect(() => {
    api.get<LenderDashboardStats>("/api/lender/dashboard/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <MetricCard label="Requests Raised" value={stats.requests_raised} icon={Send} accentColor="blue" />
      <MetricCard label="Awaiting Reports" value={stats.awaiting_reports} icon={Clock} accentColor="amber" />
      <MetricCard label="Reports Received" value={stats.reports_received} icon={FileText} accentColor="purple" />
      <MetricCard label="Reports Accepted" value={stats.reports_accepted} icon={CheckCircle} accentColor="emerald" />
      <MetricCard label="Listings Purchased" value={stats.listings_purchased} icon={ShoppingCart} accentColor="orange" />
    </div>
  );
}
