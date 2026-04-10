"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EligibleVendor, ReportRequestCreate } from "@/types/request";

type Props = {
  data: Partial<ReportRequestCreate>;
  onBack: () => void;
  onNext: (data: Partial<ReportRequestCreate>) => void;
};

export function ReportConfigForm({ data, onBack, onNext }: Props) {
  const [reportCategory, setReportCategory] = useState(data.report_category || "VALUATION");
  const [vendorId, setVendorId] = useState(data.vendor_specified_id || "");
  const [allowBroadcast, setAllowBroadcast] = useState(data.allow_broadcast_on_reject ?? true);
  const [comments, setComments] = useState(data.comments || "");
  const [vendors, setVendors] = useState<EligibleVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  useEffect(() => {
    if (data.city && reportCategory) {
      setLoadingVendors(true);
      const params = new URLSearchParams({
        city: data.city,
        report_category: reportCategory,
        ...(data.area ? { area: data.area } : {}),
      });
      api
        .get<EligibleVendor[]>(`/api/lender/requests/vendors?${params}`)
        .then(setVendors)
        .catch(() => setVendors([]))
        .finally(() => setLoadingVendors(false));
    }
  }, [data.city, data.area, reportCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      report_category: reportCategory as "VALUATION" | "LEGAL",
      vendor_specified_id: vendorId || undefined,
      allow_broadcast_on_reject: allowBroadcast,
      comments: comments || undefined,
    });
  };

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Report Configuration</h2>

      <div>
        <label className={labelClass}>Report Category *</label>
        <select className={inputClass} required value={reportCategory}
          onChange={(e) => setReportCategory(e.target.value as "VALUATION" | "LEGAL")}>
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Preferred Vendor (optional)</label>
        {loadingVendors ? (
          <p className="text-sm text-gray-500">Loading vendors...</p>
        ) : (
          <select className={inputClass} value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Auto-assign (broadcast to area vendors)</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
            ))}
          </select>
        )}
      </div>

      {vendorId && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="allowBroadcast" checked={allowBroadcast}
            onChange={(e) => setAllowBroadcast(e.target.checked)}
            className="rounded border-gray-300" />
          <label htmlFor="allowBroadcast" className="text-sm text-gray-700">
            Broadcast to other vendors if preferred vendor rejects
          </label>
        </div>
      )}

      <div>
        <label className={labelClass}>Comments</label>
        <textarea className={inputClass} rows={3} value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Any additional notes for the vendor..." />
      </div>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack}
          className="border px-6 py-2 rounded-lg text-sm hover:bg-gray-50">
          Back
        </button>
        <button type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">
          Next
        </button>
      </div>
    </form>
  );
}
