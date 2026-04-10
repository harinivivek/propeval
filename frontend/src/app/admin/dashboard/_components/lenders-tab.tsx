"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { AdminLenderRow, PaginatedResponse } from "@/types/dashboard";

export function LendersTab() {
  const [items, setItems] = useState<AdminLenderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (cityFilter) params.set("city", cityFilter);
      const data = await api.get<PaginatedResponse<AdminLenderRow>>(`/api/admin/dashboard/lenders?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page, cityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (cityFilter) params.set("city", cityFilter);
    const token = localStorage.getItem("access_token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/admin/dashboard/lenders/export?${params}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "lenders.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by city..."
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64"
        />
        <button onClick={handleExport} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Lender</th>
                  <th className="text-left py-2">City</th>
                  <th className="text-right py-2">Requests</th>
                  <th className="text-right py-2">Reports</th>
                  <th className="text-right py-2">Purchases</th>
                  <th className="text-right py-2">Total Payable</th>
                  <th className="text-right py-2">Total Paid</th>
                  <th className="text-right py-2">Vendors</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.lender_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.lender_name}</td>
                    <td className="py-2">{r.city || "—"}</td>
                    <td className="text-right py-2">{r.requests_raised}</td>
                    <td className="text-right py-2">{r.reports_received}</td>
                    <td className="text-right py-2">{r.listings_purchased}</td>
                    <td className="text-right py-2">₹{parseFloat(r.total_payable).toLocaleString()}</td>
                    <td className="text-right py-2">₹{parseFloat(r.total_paid).toLocaleString()}</td>
                    <td className="text-right py-2">{r.vendor_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.lender_id} className="border rounded-lg p-4">
                <p className="font-medium">{r.lender_name}</p>
                <p className="text-sm text-gray-500">{r.city || "—"}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <span>Requests: {r.requests_raised}</span>
                  <span>Reports: {r.reports_received}</span>
                  <span>Payable: ₹{parseFloat(r.total_payable).toLocaleString()}</span>
                  <span>Paid: ₹{parseFloat(r.total_paid).toLocaleString()}</span>
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
