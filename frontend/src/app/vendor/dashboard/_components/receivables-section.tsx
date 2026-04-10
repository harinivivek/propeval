"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { VendorReceivablesResponse } from "@/types/dashboard";

interface Props {
  fyYear: number;
}

export function ReceivablesSection({ fyYear }: Props) {
  const [data, setData] = useState<VendorReceivablesResponse | null>(null);

  useEffect(() => {
    api.get<VendorReceivablesResponse>(`/api/vendor/dashboard/receivables?fy_year=${fyYear}`)
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

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
    </div>
  );
}
