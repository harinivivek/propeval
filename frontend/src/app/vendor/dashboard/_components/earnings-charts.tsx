"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorEarningsResponse } from "@/types/dashboard";

interface Props {
  fyYear: number;
}

export function EarningsCharts({ fyYear }: Props) {
  const [data, setData] = useState<VendorEarningsResponse | null>(null);
  const [reportPage, setReportPage] = useState(1);

  useEffect(() => {
    api.get<VendorEarningsResponse>(
      `/api/vendor/dashboard/earnings?fy_year=${fyYear}&page=${reportPage}&page_size=10`
    )
      .then(setData)
      .catch(() => {});
  }, [fyYear, reportPage]);

  if (!data) {
    return <Skeleton className="h-64 rounded-lg" />;
  }

  const lenderChartData = data.lender_wise.map((r) => ({
    name: r.lender_name,
    amount: parseFloat(r.total_amount),
  }));

  const monthChartData = data.month_wise.map((r) => ({
    name: r.month,
    amount: parseFloat(r.total_amount),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Earnings by Lender</CardTitle>
        </CardHeader>
        <CardContent>
          {lenderChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={lenderChartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Earnings"]} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {monthChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Earnings"]} />
                <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Reports by Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {data.report_wise.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Earnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.report_wise.map((r) => (
                      <TableRow key={r.report_id} className="hover:bg-muted">
                        <TableCell>{r.property_address || "—"}</TableCell>
                        <TableCell>{r.report_category}</TableCell>
                        <TableCell className="text-right font-medium">₹{parseFloat(r.total_amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                  disabled={reportPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {reportPage}</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setReportPage((p) => p + 1)}
                  disabled={data.report_wise.length < 10}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
