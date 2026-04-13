"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingRequestItem } from "@/types/dashboard";

function timeRemaining(deadline: string | null): string {
  if (!deadline) return "—";
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

export function PendingRequestsTable() {
  const [requests, setRequests] = useState<PendingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PendingRequestItem[]>("/api/vendor/dashboard/pending-requests")
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Skeleton className="h-32 rounded-lg" />;
  }

  if (requests.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="text-amber-800">Pending Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-amber-200">
                <TableHead>Lender</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">ETA</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Time Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} className="border-amber-100 hover:bg-amber-100/50">
                  <TableCell>
                    <Link href={`/vendor/requests/${r.id}`} className="text-primary hover:underline">
                      {r.lender_name}
                    </Link>
                  </TableCell>
                  <TableCell>{r.property_address || "—"}</TableCell>
                  <TableCell>{r.report_category}</TableCell>
                  <TableCell className="text-right">{r.eta_days ? `${r.eta_days}d` : "—"}</TableCell>
                  <TableCell className="text-right">{r.price ? `₹${parseFloat(r.price).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right font-medium">{timeRemaining(r.accept_deadline)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {requests.map((r) => (
            <Link key={r.id} href={`/vendor/requests/${r.id}`} className="block bg-background rounded-lg p-4 border border-amber-200">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">{r.lender_name}</span>
                <span className="text-sm font-medium text-amber-700">{timeRemaining(r.accept_deadline)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{r.property_address || "—"}</p>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>{r.report_category}</span>
                {r.price && <span>₹{parseFloat(r.price).toLocaleString()}</span>}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
