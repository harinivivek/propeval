"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { RecentRequestItem } from "@/types/dashboard";

export function RecentRequestsTable() {
  const [requests, setRequests] = useState<RecentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RecentRequestItem[]>("/api/lender/dashboard/recent-requests")
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Requests</CardTitle>
        <Link href="/lender/requests" className="text-sm text-primary hover:underline">
          View all &rarr;
        </Link>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No requests yet</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/lender/requests/${r.id}`} className="text-primary hover:underline">
                          {r.property_address || "\u2014"}
                        </Link>
                      </TableCell>
                      <TableCell>{r.report_category}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.lender_status} />
                      </TableCell>
                      <TableCell>{r.vendor_name || "\u2014"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {requests.map((r) => (
                <Link key={r.id} href={`/lender/requests/${r.id}`} className="block">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm text-foreground">{r.property_address || "\u2014"}</span>
                        <StatusBadge status={r.lender_status} />
                      </div>
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        <span>{r.report_category}</span>
                        <span>{r.vendor_name || "Unassigned"}</span>
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
