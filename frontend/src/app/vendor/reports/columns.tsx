"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import type { VendorReportItem } from "@/types/dashboard";

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export type VendorReportColumnsOptions = {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAllOnPage: (ids: string[], checked: boolean) => void;
  pageRowIds: string[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatUploaded(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function createVendorReportColumns({
  selectedIds,
  onToggle,
  onToggleAllOnPage,
  pageRowIds,
}: VendorReportColumnsOptions): ColumnDef<VendorReportItem>[] {
  const allOnPage =
    pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));
  const someOnPage = pageRowIds.some((id) => selectedIds.has(id));

  return [
    {
      id: "select",
      header: () => (
        <div className="flex items-center" data-stop-row-nav>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={allOnPage}
            ref={(el) => {
              if (el) el.indeterminate = someOnPage && !allOnPage;
            }}
            onChange={(e) => onToggleAllOnPage(pageRowIds, e.target.checked)}
            aria-label="Select all on this page"
          />
        </div>
      ),
      cell: ({ row }: { row: Row<VendorReportItem> }) => (
        <div
          className="flex items-center pt-0.5"
          data-stop-row-nav
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={selectedIds.has(row.original.id)}
            onChange={() => onToggle(row.original.id)}
            aria-label={`Select report ${row.original.property_address || row.original.id}`}
          />
        </div>
      ),
    },
    {
      accessorKey: "property_address",
      header: "Property Address",
      cell: ({ row }: { row: Row<VendorReportItem> }) => (
        <span className="font-medium text-gray-900">
          {row.original.property_address || "—"}
        </span>
      ),
    },
    {
      accessorKey: "report_category",
      header: "Category",
    },
    {
      accessorKey: "property_type",
      header: "Type",
      cell: ({ row }: { row: Row<VendorReportItem> }) => (
        <span className="capitalize">
          {row.getValue("property_type")?.toString().toLowerCase() || "—"}
        </span>
      ),
    },
    {
      accessorKey: "report_date",
      header: "Upload date",
      cell: ({ row }: { row: Row<VendorReportItem> }) => formatDate(row.original.report_date),
    },
    {
      accessorKey: "uploaded_at",
      header: "Uploaded",
      cell: ({ row }: { row: Row<VendorReportItem> }) => formatUploaded(row.original.uploaded_at),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: Row<VendorReportItem> }) => {
        const s = row.original.status;
        return (
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s] || "bg-gray-100 text-gray-700"}`}
          >
            {s}
          </span>
        );
      },
    },
    {
      accessorKey: "valuation_amount",
      header: "Valuation",
      cell: ({ row }: { row: Row<VendorReportItem> }) => {
        const val = row.getValue("valuation_amount") as string | null;
        return val ? `₹${parseFloat(val).toLocaleString("en-IN")}` : "—";
      },
    },
  ];
}
