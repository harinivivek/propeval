"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { AdminReportRow, PaginatedResponse } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export function ReportsTab() {
  const [items, setItems] = useState<AdminReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      const data = await api.get<PaginatedResponse<AdminReportRow>>(`/api/admin/dashboard/reports?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page, categoryFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    const token = localStorage.getItem("access_token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/admin/dashboard/reports/export?${params}`;
    window.open(`${url}&token=${token}`, "_blank");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex gap-3">
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Categories</option>
            <option value="VALUATION">Valuation</option>
            <option value="LEGAL">Legal</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All Statuses</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="PROCESSING">Processing</option>
            <option value="READY_TO_PUBLISH">Ready to Publish</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded" />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">Lender</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Valuation</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.report_id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{r.report_date || "—"}</td>
                    <td className="py-2">{r.vendor_name}</td>
                    <td className="py-2">{r.lender_name || "—"}</td>
                    <td className="py-2">{r.property_address || "—"}</td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status}</span>
                    </td>
                    <td className="text-right py-2">{r.valuation_amount ? `₹${parseFloat(r.valuation_amount).toLocaleString()}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.report_id} className="border rounded-lg p-4">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-sm">{r.vendor_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status}</span>
                </div>
                <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
                <div className="flex gap-3 text-sm text-gray-500 mt-1">
                  <span>{r.report_category}</span>
                  <span>{r.report_date || "—"}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-sm text-blue-600 disabled:text-gray-400">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="text-sm text-blue-600 disabled:text-gray-400">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
