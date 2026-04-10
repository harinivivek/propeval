"use client";

import { useEffect, useState } from "react";
import { FileText, Download, List, CheckCircle, Inbox, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { VendorDashboardStats } from "@/types/dashboard";

export function VendorStats() {
  const [stats, setStats] = useState<VendorDashboardStats | null>(null);

  useEffect(() => {
    api.get<VendorDashboardStats>("/api/vendor/dashboard/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard label="Requests Received" value={stats.requests_received} icon={Inbox} color="text-blue-600" />
      <MetricCard label="Requests Accepted" value={stats.requests_accepted} icon={CheckCircle} color="text-green-600" />
      <MetricCard label="Reports Served" value={stats.reports_served} icon={FileText} color="text-purple-600" />
      <MetricCard label="Reports Listed" value={stats.reports_listed} icon={List} color="text-indigo-600" />
      <MetricCard label="Downloads" value={stats.downloads} icon={Download} color="text-orange-600" />
      <MetricCard label="Active Listings" value={stats.active_listings} icon={BarChart3} color="text-teal-600" />
    </div>
  );
}
