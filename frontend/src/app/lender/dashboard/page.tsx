"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { LenderStats } from "./_components/lender-stats";
import { PayablesSection } from "./_components/payables-section";
import { RecentRequestsTable } from "./_components/recent-requests-table";

function getCurrentFY(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function LenderDashboardPage() {
  const [fyYear, setFyYear] = useState(getCurrentFY());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <DateRangeFilter selectedYear={fyYear} onChange={setFyYear} />
          <Link
            href="/lender/requests/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Raise Request
          </Link>
        </div>
      </div>

      <LenderStats />
      <PayablesSection fyYear={fyYear} />
      <RecentRequestsTable />
    </div>
  );
}
