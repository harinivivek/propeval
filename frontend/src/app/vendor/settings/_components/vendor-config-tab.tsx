"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { VendorConfigWithExclusions } from "@/types/config";

interface LenderOption {
  id: string;
  name: string;
}

export function VendorConfigTab() {
  const [data, setData] = useState<VendorConfigWithExclusions | null>(null);
  const [lenders, setLenders] = useState<LenderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state
  const [autoListing, setAutoListing] = useState(false);
  const [priceThreshold, setPriceThreshold] = useState("");
  const [separateValLegal, setSeparateValLegal] = useState(false);
  const [selectedLenderId, setSelectedLenderId] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<VendorConfigWithExclusions>("/api/vendor/settings/config"),
      api.get<LenderOption[]>("/api/vendor/settings/lenders"),
    ])
      .then(([configData, lenderData]) => {
        setData(configData);
        setAutoListing(configData.config.auto_listing_enabled);
        setPriceThreshold(configData.config.price_threshold ?? "");
        setSeparateValLegal(configData.config.separate_valuation_legal);
        setLenders(lenderData);
      })
      .catch((e) => toast.error(e.message ?? "Failed to load configuration"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put<VendorConfigWithExclusions>(
        "/api/vendor/settings/config",
        {
          auto_listing_enabled: autoListing,
          price_threshold: priceThreshold === "" ? null : priceThreshold,
          separate_valuation_legal: separateValLegal,
        }
      );
      setData(updated);
      toast.success("Configuration saved");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddExclusion() {
    if (!selectedLenderId) return;
    try {
      const updated = await api.post<VendorConfigWithExclusions>(
        "/api/vendor/settings/exclusions",
        { lender_id: selectedLenderId }
      );
      setData(updated);
      setSelectedLenderId("");
      toast.success("Lender excluded");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to add exclusion");
    }
  }

  async function handleRemoveExclusion(lenderId: string) {
    try {
      const updated = await api.delete<VendorConfigWithExclusions>(
        `/api/vendor/settings/exclusions/${lenderId}`
      );
      setData(updated);
      toast.success("Exclusion removed");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to remove exclusion");
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;
  }

  const excludedIds = new Set(data?.exclusions.map((e) => e.lender_id) ?? []);
  const availableLenders = lenders.filter((l) => !excludedIds.has(l.id));

  return (
    <div className="space-y-6">
      {/* Listing Preferences */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Listing Preferences</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoListing}
            onChange={(e) => setAutoListing(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Automatically list accepted reports on the marketplace
          </span>
        </label>
      </div>

      {/* Pricing */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Pricing</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum price threshold (₹)
          </label>
          <input
            type="number"
            min="0"
            value={priceThreshold}
            onChange={(e) => setPriceThreshold(e.target.value)}
            placeholder="e.g. 500"
            className="w-full sm:w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Leave blank to accept all prices</p>
        </div>
      </div>

      {/* Report Types */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Report Types</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={separateValLegal}
            onChange={(e) => setSeparateValLegal(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm text-gray-700 font-medium">
              Separate valuation &amp; legal settings
            </span>
            <p className="text-xs text-gray-400 mt-0.5">
              Apply different pricing thresholds and listing preferences for valuation and legal reports
            </p>
          </div>
        </label>
      </div>

      {/* Save button */}
      <div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      {/* Lender Exclusions */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Lender Exclusions</h2>
        <p className="text-sm text-gray-500 mb-4">
          Excluded lenders will not receive your broadcast requests.
        </p>

        {/* Add exclusion */}
        <div className="flex gap-2 mb-4">
          <select
            value={selectedLenderId}
            onChange={(e) => setSelectedLenderId(e.target.value)}
            className="flex-1 sm:flex-none sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a lender to exclude…</option>
            {availableLenders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddExclusion}
            disabled={!selectedLenderId}
            className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>

        {/* Exclusion list */}
        {data?.exclusions.length === 0 ? (
          <p className="text-sm text-gray-400">No lenders excluded.</p>
        ) : (
          <ul className="space-y-2">
            {data?.exclusions.map((ex) => (
              <li
                key={ex.lender_id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
              >
                <span className="text-sm text-gray-700">{ex.lender_name}</span>
                <button
                  onClick={() => handleRemoveExclusion(ex.lender_id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
