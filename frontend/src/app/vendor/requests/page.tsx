"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { VendorRequestTable } from "./_components/request-table";

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
      <h1 className="text-2xl font-bold mb-6">Requests</h1>

      <div className="flex gap-1 mb-4 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.value
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : (
        <VendorRequestTable requests={requests} />
      )}
    </div>
  );
}
