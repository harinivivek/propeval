"use client";

import { useState } from "react";
import { AdminStats } from "./_components/admin-stats";
import { VendorsTab } from "./_components/vendors-tab";
import { LendersTab } from "./_components/lenders-tab";
import { ReportsTab } from "./_components/reports-tab";
import { OpenRequestsTab } from "./_components/open-requests-tab";
import { ActivityTab } from "./_components/activity-tab";

const TABS = [
  { key: "vendors", label: "Vendors" },
  { key: "lenders", label: "Lenders" },
  { key: "reports", label: "Reports" },
  { key: "open-requests", label: "Open Requests" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("vendors");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <AdminStats />

      {/* Desktop tabs */}
      <div className="hidden md:block">
        <div className="border-b">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-xs font-medium text-center ${
                activeTab === tab.key ? "text-blue-600 border-t-2 border-blue-600" : "text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-16 md:pb-0">
        {activeTab === "vendors" && <VendorsTab />}
        {activeTab === "lenders" && <LendersTab />}
        {activeTab === "reports" && <ReportsTab />}
        {activeTab === "open-requests" && <OpenRequestsTab />}
        {activeTab === "activity" && <ActivityTab />}
      </div>
    </div>
  );
}
