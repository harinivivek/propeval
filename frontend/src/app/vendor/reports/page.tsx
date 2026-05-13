"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Info, Loader2 } from "lucide-react";
import type { PaginatedResponse, VendorReportItem } from "@/types/dashboard";
import { DataTable } from "@/components/data-table";
import { columns } from "./columns";

const PROCESSED_STATUSES = "READY_TO_PUBLISH,PUBLISHED";

export default function VendorReportsPage() {
  const [reports, setReports] = useState<VendorReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          page_size: "100",
          status: PROCESSED_STATUSES,
        });
        const data = await api.get<PaginatedResponse<VendorReportItem>>(
          `/api/vendor/dashboard/reports?${params}`,
        );
        setReports(data.items);
      } catch (error) {
        console.error("Failed to fetch reports:", error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  useEffect(() => {
    if (!infoOpen) return;
    const close = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [infoOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Processed Reports</h1>

      <div className="mb-2 flex justify-end">
        <div className="relative shrink-0" ref={infoRef}>
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            aria-expanded={infoOpen}
            aria-label="About this list"
          >
            <Info className="h-5 w-5" aria-hidden />
          </button>
          {infoOpen ? (
            <div
              className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-md"
              role="region"
              aria-label="List description"
            >
              <p>
                Successfully extracted reports only: status{" "}
                <span className="font-medium text-gray-900">Ready to publish</span>{" "}
                or <span className="font-medium text-gray-900">Published</span>.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={reports}
        emptyMessage="No processed reports yet."
        getRowHref={(r) => `/vendor/reports/${r.id}`}
      />
    </div>
  );
}
