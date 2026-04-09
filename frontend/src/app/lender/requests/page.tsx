"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { RequestTable } from "./_components/request-table";

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Requests</h1>
        <a
          href="/lender/requests/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          Raise Request
        </a>
      </div>

      {/* Tabs */}
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
        <RequestTable requests={requests} />
      )}
    </div>
  );
}
