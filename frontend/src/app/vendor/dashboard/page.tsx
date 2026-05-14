"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { VendorStats } from "./_components/vendor-stats";
import { ReceivablesSection } from "./_components/receivables-section";
import { EarningsCharts } from "./_components/earnings-charts";
import { PendingRequestsTable } from "./_components/pending-requests-table";
import { InstallBanner } from "./_components/install-banner";
import { NotificationBanner } from "./_components/notification-banner";

function getCurrentFY(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function VendorDashboardPage() {
  const [fyYear, setFyYear] = useState(getCurrentFY());

  return (
    <div className="space-y-6">
      <InstallBanner />
      <NotificationBanner />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <DateRangeFilter selectedYear={fyYear} onChange={setFyYear} />
          <Link
            href="/vendor/reports/bulk-upload"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Upload Reports
          </Link>
        </div>
      </div>

      <VendorStats />
      <PendingRequestsTable />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReceivablesSection fyYear={fyYear} />
        <div /> {/* spacer for layout */}
      </div>

      <EarningsCharts fyYear={fyYear} />
    </div>
  );
}
