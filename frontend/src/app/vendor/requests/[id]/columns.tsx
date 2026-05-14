import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import type { Report, ReportStatus } from "@/types/report";

export const columns: ColumnDef<Report>[] = [
  {
    accessorKey: "report_date",
    header: "Report Date",
    cell: ({ row }) => {
      const report = row.original;
      return report.report_date ? new Date(report.report_date).toLocaleDateString() : "-";
    },
  },
  {
    accessorKey: "property_address",
    header: "Property Address",
    cell: ({ row }) => {
      const report = row.original;
      // Only link if the report is ready for review or published
      const isViewable = (["READY_TO_PUBLISH", "PUBLISHED"] as ReportStatus[]).includes(report.status);
      
      // Use the request_id to link to the request detail page which hosts the extraction review
      const detailUrl = report.request_id ? `/vendor/requests/${report.request_id}` : null;

      if (isViewable && detailUrl) {
        return (
          <Link 
            href={detailUrl}
            className="text-blue-600 hover:underline font-medium"
          >
            {report.property_address || "View Report Data"}
          </Link>
        );
      }

      return <span>{report.property_address || "Extraction Pending..."}</span>;
    },
  },
  // ... other columns like status, valuation_amount, etc.
];
