"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { SystemConfigResponse } from "@/types/config";

const KNOWN_FIELDS = [
  "property_address",
  "property_type",
  "valuation_amount",
  "plot_extent_sqft",
  "built_up_sqft",
  "loan_applicant_name",
  "report_date",
  "city",
  "pin_code",
  "latitude",
  "longitude",
  "report_category",
  "expiry_date",
];

export default function SystemConfigForm() {
  const [config, setConfig] = useState<SystemConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendorsPerRound, setVendorsPerRound] = useState(5);
  const [acceptWindow, setAcceptWindow] = useState(30);
  const [autoAcceptDays, setAutoAcceptDays] = useState(7);
  const [maxUploadMb, setMaxUploadMb] = useState(20);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.get<SystemConfigResponse>("/api/admin/system-config");
      setConfig(data);
      setVendorsPerRound(data.vendors_per_broadcast_round);
      setAcceptWindow(data.broadcast_accept_window_minutes);
      setAutoAcceptDays(data.auto_accept_days);
      setMaxUploadMb(data.max_upload_size_mb);
      setRequiredFields(data.required_report_fields || []);
    } catch {
      toast.error("Failed to load system config");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await api.put<SystemConfigResponse>("/api/admin/system-config", {
        vendors_per_broadcast_round: vendorsPerRound,
        broadcast_accept_window_minutes: acceptWindow,
        auto_accept_days: autoAcceptDays,
        max_upload_size_mb: maxUploadMb,
        required_report_fields: requiredFields,
      });
      setConfig(data);
      toast.success("System config updated");
    } catch {
      toast.error("Failed to update system config");
    } finally {
      setSaving(false);
    }
  }

  function toggleField(field: string) {
    setRequiredFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Broadcast Settings */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-base font-semibold mb-1">Broadcast Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Controls how requests are broadcast to vendors</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="vendors-per-round" className="block text-sm font-medium text-gray-700 mb-1">
              Vendors per broadcast round
            </label>
            <input
              id="vendors-per-round"
              type="number"
              min={1}
              max={50}
              value={vendorsPerRound}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendorsPerRound(Number(e.target.value))}
              className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="accept-window" className="block text-sm font-medium text-gray-700 mb-1">
              Accept window (minutes)
            </label>
            <input
              id="accept-window"
              type="number"
              min={5}
              max={1440}
              value={acceptWindow}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAcceptWindow(Number(e.target.value))}
              className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Acceptance Settings */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-base font-semibold mb-1">Acceptance Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Auto-accept rules for pending requests</p>
        <div>
          <label htmlFor="auto-accept-days" className="block text-sm font-medium text-gray-700 mb-1">
            Auto-accept after (days)
          </label>
          <input
            id="auto-accept-days"
            type="number"
            min={1}
            max={90}
            value={autoAcceptDays}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutoAcceptDays(Number(e.target.value))}
            className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Upload Settings */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-base font-semibold mb-1">Upload Settings</h2>
        <p className="text-sm text-gray-500 mb-4">File upload constraints</p>
        <div>
          <label htmlFor="max-upload" className="block text-sm font-medium text-gray-700 mb-1">
            Max upload size (MB)
          </label>
          <input
            id="max-upload"
            type="number"
            min={1}
            max={200}
            value={maxUploadMb}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxUploadMb(Number(e.target.value))}
            className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Validation Settings */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-base font-semibold mb-1">Validation Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Required fields before a report can be published</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {KNOWN_FIELDS.map((field) => (
            <label key={field} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiredFields.includes(field)}
                onChange={() => toggleField(field)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{field.replace(/_/g, " ")}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {config?.updated_at && (
        <p className="text-sm text-gray-400 text-right">
          Last updated: {new Date(config.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
