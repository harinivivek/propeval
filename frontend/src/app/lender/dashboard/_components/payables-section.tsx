"use client";

import { Fragment, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { LenderPayablesResponse } from "@/types/dashboard";
import { BillingEntry } from "@/types/billing";

interface Props {
  fyYear: number;
}

const PIE_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626"];

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  BILLED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
};

export function PayablesSection({ fyYear }: Props) {
  const [data, setData] = useState<LenderPayablesResponse | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    api.get<LenderPayablesResponse>(`/api/lender/dashboard/payables?fy_year=${fyYear}`)
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
      const res = await api.get<{ entries: BillingEntry[] }>(`/api/lender/billing/entries?month=${month}`);
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
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/lender/billing/export?month=${month}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lender-payables-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  if (!data) {
    return <div className="bg-white rounded-lg border p-6 h-64 animate-pulse" />;
  }

  const pieData = data.type_breakdown.map((t) => ({
    name: t.payable_type.replace(/_/g, " "),
    value: parseFloat(t.total_amount),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-2xl font-bold text-yellow-800">₹{parseFloat(data.totals.pending).toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Billed</p>
          <p className="text-2xl font-bold text-blue-800">₹{parseFloat(data.totals.billed).toLocaleString()}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">Paid</p>
          <p className="text-2xl font-bold text-green-800">₹{parseFloat(data.totals.paid).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-4">Month-wise Breakdown</h4>
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

        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-semibold mb-4">By Type</h4>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
