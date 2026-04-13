"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PortfolioResponse } from "@/types/vendor-profile";

interface VendorPortfolioProps {
  portfolio: PortfolioResponse;
  vendorId: string;
}

export function VendorPortfolio({ portfolio: initial, vendorId }: VendorPortfolioProps) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const loadPage = async (page: number) => {
    setLoading(true);
    try {
      const res = await api.get<PortfolioResponse>(
        `/api/lender/vendors/${vendorId}/portfolio?page=${page}&page_size=10`
      );
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-3">
        Portfolio <span className="text-sm text-muted-foreground font-normal">({data.total} reports)</span>
      </h2>

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published reports yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Property Type</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">City</th>
                  <th className="pb-2 font-medium">Area</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className={loading ? "opacity-50" : ""}>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">{item.property_type}</td>
                    <td className="py-2">{item.report_category}</td>
                    <td className="py-2">{item.city}</td>
                    <td className="py-2">{item.area || "-"}</td>
                    <td className="py-2 text-muted-foreground">
                      {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => loadPage(data.page - 1)}
                disabled={data.page <= 1 || loading}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {totalPages}
              </span>
              <button
                onClick={() => loadPage(data.page + 1)}
                disabled={data.page >= totalPages || loading}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
