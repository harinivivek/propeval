"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PendingRequestItem } from "@/types/dashboard";

function timeRemaining(deadline: string | null): string {
  if (!deadline) return "—";
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

export function PendingRequestsTable() {
  const [requests, setRequests] = useState<PendingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PendingRequestItem[]>("/api/vendor/dashboard/pending-requests")
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6 h-32 animate-pulse" />;
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
      <h3 className="font-semibold text-lg mb-4 text-yellow-800">Pending Requests</h3>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-yellow-200">
              <th className="text-left py-2">Lender</th>
              <th className="text-left py-2">Address</th>
              <th className="text-left py-2">Category</th>
              <th className="text-right py-2">ETA</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Time Left</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-yellow-100 hover:bg-yellow-100">
                <td className="py-2">
                  <Link href={`/vendor/requests/${r.id}`} className="text-blue-600 hover:underline">
                    {r.lender_name}
                  </Link>
                </td>
                <td className="py-2">{r.property_address || "—"}</td>
                <td className="py-2">{r.report_category}</td>
                <td className="text-right py-2">{r.eta_days ? `${r.eta_days}d` : "—"}</td>
                <td className="text-right py-2">{r.price ? `₹${parseFloat(r.price).toLocaleString()}` : "—"}</td>
                <td className="text-right py-2 font-medium">{timeRemaining(r.accept_deadline)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map((r) => (
          <Link key={r.id} href={`/vendor/requests/${r.id}`} className="block bg-white rounded-lg p-4 border border-yellow-200">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium">{r.lender_name}</span>
              <span className="text-sm font-medium text-yellow-700">{timeRemaining(r.accept_deadline)}</span>
            </div>
            <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>{r.report_category}</span>
              {r.price && <span>₹{parseFloat(r.price).toLocaleString()}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
