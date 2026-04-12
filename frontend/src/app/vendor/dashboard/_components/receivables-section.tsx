"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { VendorReceivablesResponse } from "@/types/dashboard";
import { BillingEntry } from "@/types/billing";

interface Props {
  fyYear: number;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  BILLED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
};

export function ReceivablesSection({ fyYear }: Props) {
  const [data, setData] = useState<VendorReceivablesResponse | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    api.get<VendorReceivablesResponse>(`/api/vendor/dashboard/receivables?fy_year=${fyYear}`)
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

  const toggleMonth = async (month: string) => {
    if (expandedMonth === month) {
      setExpandedMonth(null);
      setEntries([]);
      return;
    }
    setExpandedMonth(month);
    setLoadingEntries(true);
    try {
      const res = await api.get<{ entries: BillingEntry[] }>(`/api/vendor/billing/entries?month=${month}`);
      setEntries(res.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const downloadCsv = async (month: string) => {
    try {
      const blob = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/vendor/billing/export?month=${month}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendor-receivables-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  if (!data) {
    return <div className="bg-white rounded-lg border p-6 h-48 animate-pulse" />;
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="font-semibold text-lg mb-4">Receivables</h3>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-500 mb-2">By Lender</h4>
        {data.lender_wise.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Lender</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.lender_wise.map((row) => (
                  <tr key={row.lender_id} className="border-b">
                    <td className="py-2">{row.lender_name}</td>
                    <td className="text-right py-2 font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-2">Month-wise</h4>
        {data.month_wise.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Month</th>
                  <th className="text-left py-2">Invoice #</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Amount</th>
                  <th className="text-right py-2">Export</th>
                </tr>
              </thead>
              <tbody>
                {data.month_wise.map((row) => {
                  const status = row.invoice_status || "Not Generated";
                  const badgeClass = STATUS_BADGE[status] || "bg-gray-100 text-gray-600";
                  const isExpanded = expandedMonth === row.month;

                  return (
                    <Fragment key={row.month}>
                      <tr
                        className="border-b cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleMonth(row.month)}
                      >
                        <td className="py-2">
                          <span className="mr-1 text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
                          {row.month}
                        </td>
                        <td className="py-2 font-mono text-xs">{row.invoice_number || "—"}</td>
                        <td className="py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
                            {status}
                          </span>
                        </td>
                        <td className="text-right py-2 font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</td>
                        <td className="text-right py-2">
                          <button
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadCsv(row.month);
                            }}
                          >
                            CSV
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-gray-50 px-4 py-3">
                            {loadingEntries ? (
                              <p className="text-xs text-gray-400">Loading...</p>
                            ) : entries.length === 0 ? (
                              <p className="text-xs text-gray-400">No entries</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-1">Entry Type</th>
                                    <th className="text-left py-1">Report ID</th>
                                    <th className="text-right py-1">Amount</th>
                                    <th className="text-right py-1">Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entries.map((entry) => (
                                    <tr key={entry.id} className="border-b border-gray-200">
                                      <td className="py-1">{entry.entry_type.replace(/_/g, " ")}</td>
                                      <td className="py-1 font-mono">{entry.report_id.slice(0, 8)}...</td>
                                      <td className="text-right py-1">₹{parseFloat(entry.amount).toLocaleString()}</td>
                                      <td className="text-right py-1">{new Date(entry.created_at).toLocaleDateString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
