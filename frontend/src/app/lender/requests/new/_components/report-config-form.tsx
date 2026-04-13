"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EligibleVendor, ReportRequestCreate } from "@/types/request";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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

  const selectClass = "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Report Configuration</h2>

      <div className="space-y-1.5">
        <Label>Report Category *</Label>
        <select className={selectClass} required value={reportCategory}
          onChange={(e) => setReportCategory(e.target.value as "VALUATION" | "LEGAL")}>
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Preferred Vendor (optional)</Label>
        {loadingVendors ? (
          <p className="text-sm text-muted-foreground">Loading vendors...</p>
        ) : (
          <select className={selectClass} value={vendorId}
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
            className="rounded border-input accent-primary" />
          <label htmlFor="allowBroadcast" className="text-sm text-muted-foreground">
            Broadcast to other vendors if preferred vendor rejects
          </label>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Comments</Label>
        <Textarea rows={3} value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Any additional notes for the vendor..." />
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">
          Next
        </Button>
      </div>
    </form>
  );
}
