"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { VendorStats } from "./_components/vendor-stats";
import { ReceivablesSection } from "./_components/receivables-section";
import { EarningsCharts } from "./_components/earnings-charts";
import { PendingRequestsTable } from "./_components/pending-requests-table";
import { ReportsTable } from "./_components/reports-table";
import { InstallBanner } from "./_components/install-banner";
import { NotificationBanner } from "./_components/notification-banner";
import { TierCard } from "./_components/tier-card";
import { QualityScoreCard } from "./_components/quality-score-card";

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
      <PageHeader title="Dashboard">
        <DateRangeFilter selectedYear={fyYear} onChange={setFyYear} />
        <Button asChild>
          <Link href="/vendor/reports/bulk-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Reports
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TierCard />
        <QualityScoreCard />
      </div>

      <VendorStats />
      <PendingRequestsTable />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReceivablesSection fyYear={fyYear} />
        <div /> {/* spacer for layout */}
      </div>

      <EarningsCharts fyYear={fyYear} />
      <ReportsTable />
    </div>
  );
}
