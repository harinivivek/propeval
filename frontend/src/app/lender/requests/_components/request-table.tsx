"use client";

import type { ReportRequest } from "@/types/request";

const STATUS_COLORS: Record<string, string> = {
  SENT: "bg-blue-100 text-blue-800",
  AWAITED: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-green-100 text-green-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  SENT_FOR_REVIEW: "bg-orange-100 text-orange-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function RequestTable({ requests }: { requests: ReportRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-gray-500 text-center py-8">No requests found.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Property</th>
              <th className="text-left px-4 py-3 font-medium">City</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{r.property_address || "—"}</td>
                <td className="px-4 py-3">{r.city || "—"}</td>
                <td className="px-4 py-3">{r.report_category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.lender_status] || "bg-gray-100"}`}>
                    {r.lender_status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{r.price ? `₹${r.price}` : "—"}</td>
                <td className="px-4 py-3">
                  <a href={`/lender/requests/${r.id}`} className="text-blue-600 hover:underline text-sm">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map((r) => (
          <a
            key={r.id}
            href={`/lender/requests/${r.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-sm">{r.loan_applicant_name || "—"}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.lender_status] || "bg-gray-100"}`}>
                {r.lender_status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-gray-600">{r.property_address || "—"}</p>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{r.city} · {r.report_category}</span>
              <span>{r.price ? `₹${r.price}` : ""}</span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
