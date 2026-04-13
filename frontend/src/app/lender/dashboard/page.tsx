"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader title="Dashboard" description="Overview of your valuation requests">
        <DateRangeFilter selectedYear={fyYear} onChange={setFyYear} />
        <a href="/lender/requests/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Raise Request
        </a>
      </PageHeader>

      <LenderStats />
      <PayablesSection fyYear={fyYear} />
      <RecentRequestsTable />
    </div>
  );
}
