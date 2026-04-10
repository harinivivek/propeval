"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AdminOpenRequestRow, PaginatedResponse } from "@/types/dashboard";

function etaCountdown(createdAt: string, etaDays: number | null): string {
  if (!etaDays) return "—";
  const created = new Date(createdAt);
  const deadline = new Date(created.getTime() + etaDays * 86400000);
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "Overdue";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-700",
  AWAITED: "bg-yellow-100 text-yellow-700",
};

export function OpenRequestsTab() {
  const [items, setItems] = useState<AdminOpenRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      const data = await api.get<PaginatedResponse<AdminOpenRequestRow>>(`/api/admin/dashboard/open-requests?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div>
      {loading ? (
        <div className="h-48 animate-pulse bg-gray-50 rounded" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No open requests</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Lender</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">Created</th>
                  <th className="text-right py-2">ETA</th>
                  <th className="text-right py-2">Round</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.request_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.lender_name}</td>
                    <td className="py-2">{r.property_address || "—"}</td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>{r.lender_status}</span>
                    </td>
                    <td className="py-2">{r.vendor_name || "Unassigned"}</td>
                    <td className="py-2 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="text-right py-2 font-medium">{etaCountdown(r.created_at, r.eta_days)}</td>
                    <td className="text-right py-2">{r.broadcast_round || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {items.map((r) => (
              <div key={r.request_id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">{r.lender_name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>{r.lender_status}</span>
                </div>
                <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
                <div className="flex gap-3 text-sm text-gray-500 mt-1">
                  <span>{r.vendor_name || "Unassigned"}</span>
                  <span>ETA: {etaCountdown(r.created_at, r.eta_days)}</span>
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
