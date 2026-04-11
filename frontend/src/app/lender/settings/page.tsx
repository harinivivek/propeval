"use client";
import { useState } from "react";
import UsersTab from "./_components/users-tab";
import TemplateBuilder from "./_components/template-builder";
import { NotificationPrefs } from "./_components/notification-prefs";

const TABS = [
  { key: "users", label: "Users" },
  { key: "template", label: "Report Template" },
  { key: "notifications", label: "Notifications" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function LenderSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("users");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your organisation settings</p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "template" && <TemplateBuilder />}
      {activeTab === "notifications" && <NotificationPrefs />}
    </div>
  );
}
