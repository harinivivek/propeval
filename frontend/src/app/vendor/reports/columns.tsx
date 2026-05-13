"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { VendorReportItem } from "@/types/dashboard";

export const columns: ColumnDef<VendorReportItem>[] = [
  {
    accessorKey: "property_address",
    header: "Property Address",
    cell: ({ row }) => (
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
    cell: ({ row }) => (
      <span className="capitalize">
        {row.getValue("property_type")?.toString().toLowerCase() || "—"}
      </span>
    ),
  },
  {
    accessorKey: "report_date",
    header: "Report date",
    cell: ({ row }) => {
      const d = row.getValue("report_date") as string | null;
      return d ? new Date(d).toLocaleDateString() : "—";
    },
  },
  {
    accessorKey: "valuation_amount",
    header: "Valuation",
    cell: ({ row }) => {
      const val = row.getValue("valuation_amount") as string | null;
      return val ? `₹${parseFloat(val).toLocaleString("en-IN")}` : "—";
    },
  },
];
