"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { VendorEarningsResponse } from "@/types/dashboard";

interface Props {
  fyYear: number;
}

export function EarningsCharts({ fyYear }: Props) {
  const [data, setData] = useState<VendorEarningsResponse | null>(null);
  const [reportPage, setReportPage] = useState(1);

  useEffect(() => {
    api.get<VendorEarningsResponse>(
      `/api/vendor/dashboard/earnings?fy_year=${fyYear}&page=${reportPage}&page_size=10`
    )
      .then(setData)
      .catch(() => {});
  }, [fyYear, reportPage]);

  if (!data) {
    return <div className="bg-white rounded-lg border p-6 h-64 animate-pulse" />;
  }

  const lenderChartData = data.lender_wise.map((r) => ({
    name: r.lender_name,
    amount: parseFloat(r.total_amount),
  }));

  const monthChartData = data.month_wise.map((r) => ({
    name: r.month,
    amount: parseFloat(r.total_amount),
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-lg mb-4">Earnings by Lender</h3>
        {lenderChartData.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lenderChartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `₹${v.toLocaleString()}`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Earnings"]} />
              <Bar dataKey="amount" fill="#4f46e5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-lg mb-4">Monthly Earnings</h3>
        {monthChartData.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${v.toLocaleString()}`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Earnings"]} />
              <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-lg mb-4">Top Reports by Earnings</h3>
        {data.report_wise.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Address</th>
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.report_wise.map((r) => (
                    <tr key={r.report_id} className="border-b hover:bg-gray-50">
                      <td className="py-2">{r.property_address || "—"}</td>
                      <td className="py-2">{r.report_category}</td>
                      <td className="text-right py-2 font-medium">₹{parseFloat(r.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                disabled={reportPage === 1}
                className="text-sm text-blue-600 disabled:text-gray-400"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {reportPage}</span>
              <button
                onClick={() => setReportPage((p) => p + 1)}
                disabled={data.report_wise.length < 10}
                className="text-sm text-blue-600 disabled:text-gray-400"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
