"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { VendorRequestTable } from "./_components/request-table";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { label: "Incoming", value: "incoming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
];

export default function VendorRequestsPage() {
  const [requests, setRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("incoming");

  useEffect(() => {
    setLoading(true);
    api
      .get<ReportRequest[]>(`/api/vendor/requests/?status=${activeTab}`)
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div>
      <PageHeader title="Requests" description="Manage your incoming and active requests" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {loading ? (
              <div className="space-y-3 mt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <VendorRequestTable requests={requests} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
