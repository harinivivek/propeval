"use client";

import { useState } from "react";
import { VendorListingGroup } from "@/types/listing";
import { api } from "@/lib/api";

interface Props {
  group: VendorListingGroup;
  onDelisted: () => void;
}

export function ListingGroup({ group, onDelisted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { listing, reports } = group;

  const handleDelist = async (reportId: string) => {
    try {
      await api.post(`/api/vendor/listings/reports/${reportId}/delist`, {});
      onDelisted();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delist report";
      alert(message);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div>
          <span className="font-medium">{listing.macro_location}</span>
          <span className="text-gray-500 text-sm ml-2">
            {listing.city} · {listing.pin_code} · {listing.property_type}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="divide-y">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4"
            >
              <div className="text-sm">
                <span className="font-medium">{r.property_address || "No address"}</span>
                <div className="text-gray-500 mt-0.5">
                  {r.report_category} · {r.property_type}
                  {r.report_date && ` · ${r.report_date}`}
                </div>
              </div>
              <button
                onClick={() => handleDelist(r.id)}
                className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 shrink-0"
              >
                Delist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
