"use client";

import type { ReportRequest } from "@/types/request";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import Link from "next/link";

function RequestTypeBadge({ type }: { type: string }) {
  if (type === "NEW") return null;
  return (
    <Badge
      variant="outline"
      className={
        type === "UPDATE"
          ? "bg-orange-100 text-orange-800 border-orange-200"
          : "bg-blue-100 text-blue-800 border-blue-200"
      }
    >
      {type === "UPDATE" ? "Update" : "Nearby"}
    </Badge>
  );
}

export function VendorRequestTable({ requests }: { requests: ReportRequest[] }) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-muted-foreground text-center">No requests found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{r.loan_applicant_name || "\u2014"}</TableCell>
                  <TableCell>{r.city || "\u2014"}</TableCell>
                  <TableCell>{r.report_category}</TableCell>
                  <TableCell>
                    <RequestTypeBadge type={r.request_type || "NEW"} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.vendor_status || ""} />
                  </TableCell>
                  <TableCell className="text-right">{r.price ? `\u20B9${r.price}` : "\u2014"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/vendor/requests/${r.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map((r) => (
          <Link key={r.id} href={`/vendor/requests/${r.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{r.loan_applicant_name || "\u2014"}</span>
                    <RequestTypeBadge type={r.request_type || "NEW"} />
                  </div>
                  <StatusBadge status={r.vendor_status || ""} />
                </div>
                <p className="text-sm text-muted-foreground">{r.property_address || "\u2014"}</p>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{r.city} &middot; {r.report_category}</span>
                  <span>{r.price ? `\u20B9${r.price}` : ""}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
