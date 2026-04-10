"use client";

import { useEffect, useState } from "react";
import { Users, Building2, FileText, DollarSign, Clock, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { AdminDashboardStats } from "@/types/dashboard";

export function AdminStats() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    api.get<AdminDashboardStats>("/api/admin/dashboard/stats")
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
      <MetricCard label="Total Vendors" value={stats.total_vendors} icon={Building2} color="text-blue-600" />
      <MetricCard label="Total Lenders" value={stats.total_lenders} icon={Users} color="text-green-600" />
      <MetricCard label="Total Reports" value={stats.total_reports} icon={FileText} color="text-purple-600" />
      <MetricCard label="Total Revenue" value={`₹${parseFloat(stats.total_revenue).toLocaleString()}`} icon={DollarSign} color="text-emerald-600" />
      <MetricCard label="Pending Payables" value={`₹${parseFloat(stats.pending_payables).toLocaleString()}`} icon={Clock} color="text-yellow-600" />
      <MetricCard label="Open Requests" value={stats.open_requests} icon={AlertCircle} color="text-red-600" />
    </div>
  );
}
