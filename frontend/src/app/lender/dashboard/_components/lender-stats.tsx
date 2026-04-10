"use client";

import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle, ShoppingCart, Send } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
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
          <div key={i} className="bg-white rounded-lg border p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <MetricCard label="Requests Raised" value={stats.requests_raised} icon={Send} color="text-blue-600" />
      <MetricCard label="Awaiting Reports" value={stats.awaiting_reports} icon={Clock} color="text-yellow-600" />
      <MetricCard label="Reports Received" value={stats.reports_received} icon={FileText} color="text-purple-600" />
      <MetricCard label="Reports Accepted" value={stats.reports_accepted} icon={CheckCircle} color="text-green-600" />
      <MetricCard label="Listings Purchased" value={stats.listings_purchased} icon={ShoppingCart} color="text-orange-600" />
    </div>
  );
}
