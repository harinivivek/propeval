"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedResponse, VendorReportItem } from "@/types/dashboard";
import { DataTable } from "@/components/data-table";
import { createVendorReportColumns } from "./columns";

const PAGE_SIZE = 20;

export default function VendorReportsPage() {
  const [reports, setReports] = useState<VendorReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
        sort_by: "uploaded_at",
        sort_order: "desc",
      });
      if (search) params.set("search", search);
      const data = await api.get<PaginatedResponse<VendorReportItem>>(
        `/api/vendor/dashboard/reports?${params}`,
      );
      setReports(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      setReports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const pageRowIds = useMemo(() => reports.map((r) => r.id), [reports]);

  const onToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const onToggleAllOnPage = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => {
        if (checked) n.add(id);
        else n.delete(id);
      });
      return n;
    });
  }, []);

  const columns = useMemo(
    () =>
      createVendorReportColumns({
        selectedIds,
        onToggle,
        onToggleAllOnPage,
        pageRowIds,
      }),
    [selectedIds, onToggle, onToggleAllOnPage, pageRowIds],
  );

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setActionMessage(null);
    if (
      !window.confirm(
        `Delete ${selectedIds.size} report(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await api.post<{ deleted: number }>(
        "/api/vendor/reports/bulk-delete",
        { report_ids: Array.from(selectedIds) },
      );
      setActionMessage(
        res.deleted === selectedIds.size
          ? `Deleted ${res.deleted} report(s).`
          : `Removed ${res.deleted} report(s) (some may have been invalid).`,
      );
      setSelectedIds(new Set());
      await fetchReports();
    } catch (e: unknown) {
      setActionMessage(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reports</h1>

      {actionMessage ? (
        <div
          className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
          role="status"
        >
          {actionMessage}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search address or applicant..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full min-h-11 pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            aria-label="Search reports"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link
            href="/vendor/reports/bulk-upload"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden />
            Upload reports
          </Link>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={selectedIds.size === 0 || deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            Delete selected
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={reports}
            emptyMessage="No reports yet."
            getRowHref={(r) => `/vendor/reports/${r.id}`}
          />

          {total > PAGE_SIZE ? (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <span>
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 min-h-11 text-blue-600 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-white"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 min-h-11 text-blue-600 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-white"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
