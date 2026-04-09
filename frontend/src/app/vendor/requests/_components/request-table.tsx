"use client";

import type { ReportRequest } from "@/types/request";

const STATUS_COLORS: Record<string, string> = {
  INCOMING: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  REVISION: "bg-orange-100 text-orange-800",
  SENT: "bg-green-100 text-green-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  DENIED: "bg-red-100 text-red-800",
};

export function VendorRequestTable({ requests }: { requests: ReportRequest[] }) {
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
              <th className="text-left px-4 py-3 font-medium">Applicant</th>
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
                <td className="px-4 py-3">{r.loan_applicant_name || "\u2014"}</td>
                <td className="px-4 py-3">{r.city || "\u2014"}</td>
                <td className="px-4 py-3">{r.report_category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.vendor_status || ""] || "bg-gray-100"}`}>
                    {(r.vendor_status || "\u2014").replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{r.price ? `\u20B9${r.price}` : "\u2014"}</td>
                <td className="px-4 py-3">
                  <a href={`/vendor/requests/${r.id}`} className="text-blue-600 hover:underline text-sm">
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
          <a key={r.id} href={`/vendor/requests/${r.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-sm">{r.loan_applicant_name || "\u2014"}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.vendor_status || ""] || "bg-gray-100"}`}>
                {(r.vendor_status || "\u2014").replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-gray-600">{r.property_address || "\u2014"}</p>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{r.city} &middot; {r.report_category}</span>
              <span>{r.price ? `\u20B9${r.price}` : ""}</span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
