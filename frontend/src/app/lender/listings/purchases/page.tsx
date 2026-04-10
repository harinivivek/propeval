"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PurchasedReportsResponse } from "@/types/listing";
import { UpdateRequestDialog } from "../[id]/_components/update-request-dialog";

export default function PurchasedReportsPage() {
  const [data, setData] = useState<PurchasedReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [updateReportId, setUpdateReportId] = useState<string | null>(null);
  const [updateReportMeta, setUpdateReportMeta] = useState<{category: string; address: string | null; date: string | null} | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<PurchasedReportsResponse>(
          `/api/lender/listings/purchases?page=${page}`
        );
        setData(res);
      } catch {
        setError("Failed to load purchases");
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [page]);

  const handleDownload = async (purchaseId: string) => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/lender/listings/purchases/${purchaseId}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${purchaseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download report");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Purchased Reports</h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data && data.items.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Location</th>
                  <th className="text-left p-3 font-medium">City</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Purchased</th>
                  <th className="text-right p-3 font-medium">Price</th>
                  <th className="text-right p-3 font-medium">Action</th>
                  <th className="text-right p-3 font-medium">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((item) => (
                  <tr key={item.purchase.id} className="hover:bg-gray-50">
                    <td className="p-3">{item.report.property_address || "—"}</td>
                    <td className="p-3">{item.report.city || "—"}</td>
                    <td className="p-3">{item.report.property_type || "—"}</td>
                    <td className="p-3">{item.report.report_category}</td>
                    <td className="p-3">{new Date(item.purchase.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right">₹{item.purchase.price}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDownload(item.purchase.id)}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Download
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setUpdateReportId(item.report.id);
                          setUpdateReportMeta({
                            category: item.report.report_category,
                            address: item.report.property_address,
                            date: item.report.report_date,
                          });
                        }}
                        className="px-3 py-1.5 text-sm border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.items.map((item) => (
              <div key={item.purchase.id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm">{item.report.property_address || "—"}</p>
                    <p className="text-xs text-gray-500">{item.report.city} · {item.report.property_type}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100">{item.report.report_category}</span>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <div className="text-sm">
                    <span className="text-gray-500">₹{item.purchase.price}</span>
                    <span className="text-gray-400 ml-2">{new Date(item.purchase.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setUpdateReportId(item.report.id);
                        setUpdateReportMeta({
                          category: item.report.report_category,
                          address: item.report.property_address,
                          date: item.report.report_date,
                        });
                      }}
                      className="px-3 py-2 text-sm border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => handleDownload(item.purchase.id)}
                      className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.total > data.page_size && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.page_size >= data.total}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No purchased reports yet. Browse the <a href="/lender/listings" className="text-blue-600 hover:underline">listings marketplace</a> to find reports.</p>
      )}
      {updateReportId && updateReportMeta && (
        <UpdateRequestDialog
          reportId={updateReportId}
          reportCategory={updateReportMeta.category}
          locality={updateReportMeta.address}
          reportDate={updateReportMeta.date}
          onSuccess={() => {
            setUpdateReportId(null);
            setUpdateReportMeta(null);
            window.location.href = "/lender/requests";
          }}
          onCancel={() => {
            setUpdateReportId(null);
            setUpdateReportMeta(null);
          }}
        />
      )}
    </div>
  );
}
