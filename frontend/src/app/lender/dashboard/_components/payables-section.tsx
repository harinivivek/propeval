"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { LenderPayablesResponse } from "@/types/dashboard";

interface Props {
  fyYear: number;
}

const PIE_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626"];

export function PayablesSection({ fyYear }: Props) {
  const [data, setData] = useState<LenderPayablesResponse | null>(null);

  useEffect(() => {
    api.get<LenderPayablesResponse>(`/api/lender/dashboard/payables?fy_year=${fyYear}`)
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

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
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.month_wise.map((row) => (
                    <tr key={row.month} className="border-b">
                      <td className="py-2">{row.month}</td>
                      <td className="text-right py-2 font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
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
