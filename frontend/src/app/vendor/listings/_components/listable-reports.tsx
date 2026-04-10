"use client";

import { VendorListingReportItem } from "@/types/listing";
import { api } from "@/lib/api";

interface Props {
  reports: VendorListingReportItem[];
  onListed: () => void;
}

export function ListableReports({ reports, onListed }: Props) {
  const handleList = async (reportId: string) => {
    try {
      await api.post(`/api/vendor/listings/reports/${reportId}/list`, {});
      onListed();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to list report";
      alert(message);
    }
  };

  if (reports.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">
        {reports.length} unlisted published report{reports.length !== 1 ? "s" : ""} available
      </h3>
      <div className="space-y-2">
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded bg-white p-3 border"
          >
            <div className="text-sm">
              <span className="font-medium">{r.property_address || "No address"}</span>
              <span className="text-gray-500 ml-2">
                {r.city} · {r.pin_code} · {r.report_category} · {r.property_type}
              </span>
              {r.report_date && (
                <span className="text-gray-400 ml-2">{r.report_date}</span>
              )}
            </div>
            <button
              onClick={() => handleList(r.id)}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"
            >
              List on Marketplace
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
