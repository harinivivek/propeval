"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { LenderConfigWithPreferences, VendorPreferenceEntry } from "@/types/config";

export function LenderConfigTab() {
  const [preferences, setPreferences] = useState<VendorPreferenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    api.get<LenderConfigWithPreferences>("/api/lender/settings/config")
      .then((data) => setPreferences(data.vendor_preferences))
      .catch((e) => toast.error(e.message ?? "Failed to load configuration"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(vendorId: string, currentValue: boolean) {
    setTogglingId(vendorId);
    try {
      await api.put(`/api/lender/settings/vendors/${vendorId}/preference`, {
        auto_approve: !currentValue,
      });
      setPreferences((prev) =>
        prev.map((p) =>
          p.vendor_id === vendorId ? { ...p, auto_approve: !currentValue } : p
        )
      );
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to update preference");
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = preferences.filter((p) =>
    p.vendor_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Vendor Auto-Approve</h2>
        <p className="text-sm text-gray-500 mb-4">
          When enabled, reports from a vendor are auto-approved without manual review.
        </p>

        {preferences.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No vendor history yet. Vendors will appear here after completing requests.
          </p>
        ) : (
          <>
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors…"
                className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Desktop/Tablet: Table */}
            <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Auto-Approve</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400 text-sm">
                        No vendors match your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.vendor_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.vendor_name}</td>
                        <td className="px-4 py-3">
                          <button
                            role="switch"
                            aria-checked={p.auto_approve}
                            disabled={togglingId === p.vendor_id}
                            onClick={() => handleToggle(p.vendor_id, p.auto_approve)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                              p.auto_approve ? "bg-blue-600" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                p.auto_approve ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile: Card list */}
            <div className="md:hidden space-y-3">
              {filtered.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">No vendors match your search.</p>
              ) : (
                filtered.map((p) => (
                  <div
                    key={p.vendor_id}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                  >
                    <span className="text-sm font-medium text-gray-900">{p.vendor_name}</span>
                    <button
                      role="switch"
                      aria-checked={p.auto_approve}
                      disabled={togglingId === p.vendor_id}
                      onClick={() => handleToggle(p.vendor_id, p.auto_approve)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                        p.auto_approve ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          p.auto_approve ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
