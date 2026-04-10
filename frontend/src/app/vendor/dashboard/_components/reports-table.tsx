"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { PaginatedResponse, VendorReportItem } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export function ReportsTable() {
  const [items, setItems] = useState<VendorReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const data = await api.get<PaginatedResponse<VendorReportItem>>(
        `/api/vendor/dashboard/reports?${params}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="font-semibold text-lg mb-4">Reports</h3>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search address or applicant..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Statuses</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="PROCESSING">Processing</option>
          <option value="READY_TO_PUBLISH">Ready to Publish</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse bg-gray-50 rounded" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No reports found</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Valuation</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{r.report_date || "—"}</td>
                    <td className="py-2">
                      <Link href={`/vendor/reports`} className="text-blue-600 hover:underline">
                        {r.property_address || "—"}
                      </Link>
                    </td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">{r.property_type || "—"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="text-right py-2">
                      {r.valuation_amount ? `₹${parseFloat(r.valuation_amount).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">{r.property_address || "—"}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>
                    {r.status}
                  </span>
                </div>
                <div className="flex gap-3 text-sm text-gray-500">
                  <span>{r.report_category}</span>
                  <span>{r.report_date || "—"}</span>
                  {r.valuation_amount && <span>₹{parseFloat(r.valuation_amount).toLocaleString()}</span>}
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
