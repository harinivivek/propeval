"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { RequestTable } from "./_components/request-table";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

const TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

export default function LenderRequestsPage() {
  const [requests, setRequests] = useState<ReportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = activeTab ? `?status=${activeTab}` : "";
    api
      .get<ReportRequest[]>(`/api/lender/requests/${params}`)
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div>
      <PageHeader title="Requests">
        <a
          href="/lender/requests/new"
          className={buttonVariants({ variant: "default", size: "default" })}
        >
          Raise Request
        </a>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : (
        <RequestTable requests={requests} />
      )}
    </div>
  );
}
