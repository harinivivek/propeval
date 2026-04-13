"use client";

import { useEffect, useState } from "react";
import { FileText, Download, List, CheckCircle, Inbox, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
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
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard label="Requests Received" value={stats.requests_received} icon={Inbox} accentColor="blue" />
      <MetricCard label="Requests Accepted" value={stats.requests_accepted} icon={CheckCircle} accentColor="emerald" />
      <MetricCard label="Reports Served" value={stats.reports_served} icon={FileText} accentColor="purple" />
      <MetricCard label="Reports Listed" value={stats.reports_listed} icon={List} accentColor="blue" />
      <MetricCard label="Downloads" value={stats.downloads} icon={Download} accentColor="orange" />
      <MetricCard label="Active Listings" value={stats.active_listings} icon={BarChart3} accentColor="teal" />
    </div>
  );
}
