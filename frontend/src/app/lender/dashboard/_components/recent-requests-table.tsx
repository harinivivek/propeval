"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { RecentRequestItem } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  AWAITED: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-purple-100 text-purple-700",
  ACCEPTED: "bg-green-100 text-green-700",
  SENT_FOR_REVIEW: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
};

export function RecentRequestsTable() {
  const [requests, setRequests] = useState<RecentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RecentRequestItem[]>("/api/lender/dashboard/recent-requests")
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="bg-white rounded-lg border p-6 h-48 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Recent Requests</h3>
        <Link href="/lender/requests" className="text-sm text-blue-600 hover:text-blue-800">
          View all →
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No requests yet</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Vendor</th>
                  <th className="text-left py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/lender/requests/${r.id}`} className="text-blue-600 hover:underline">
                        {r.property_address || "—"}
                      </Link>
                    </td>
                    <td className="py-2">{r.report_category}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>
                        {r.lender_status}
                      </span>
                    </td>
                    <td className="py-2">{r.vendor_name || "—"}</td>
                    <td className="py-2 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {requests.map((r) => (
              <Link key={r.id} href={`/lender/requests/${r.id}`} className="block border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm">{r.property_address || "—"}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.lender_status] || ""}`}>
                    {r.lender_status}
                  </span>
                </div>
                <div className="flex gap-3 text-sm text-gray-500">
                  <span>{r.report_category}</span>
                  <span>{r.vendor_name || "Unassigned"}</span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
