"use client";

import type { ReportRequest } from "@/types/request";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export function RequestTable({ requests }: { requests: ReportRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No requests found.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{r.property_address || "—"}</TableCell>
                <TableCell>{r.city || "—"}</TableCell>
                <TableCell>{r.report_category}</TableCell>
                <TableCell>
                  <StatusBadge status={r.lender_status} />
                </TableCell>
                <TableCell className="text-right">{r.price ? `₹${r.price}` : "—"}</TableCell>
                <TableCell>
                  <a href={`/lender/requests/${r.id}`} className="text-primary hover:underline text-sm">
                    View
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map((r) => (
          <a
            key={r.id}
            href={`/lender/requests/${r.id}`}
            className="block"
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm text-foreground">{r.loan_applicant_name || "—"}</span>
                  <StatusBadge status={r.lender_status} />
                </div>
                <p className="text-sm text-muted-foreground">{r.property_address || "—"}</p>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{r.city} · {r.report_category}</span>
                  <span>{r.price ? `₹${r.price}` : ""}</span>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </>
  );
}
