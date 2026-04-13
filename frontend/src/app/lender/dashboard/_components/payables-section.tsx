"use client";

import { Fragment, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";
import { Clock, FileCheck, CircleDollarSign } from "lucide-react";
import { LenderPayablesResponse } from "@/types/dashboard";
import { BillingEntry } from "@/types/billing";

interface Props {
  fyYear: number;
}

const PIE_COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626"];

export function PayablesSection({ fyYear }: Props) {
  const [data, setData] = useState<LenderPayablesResponse | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    api.get<LenderPayablesResponse>(`/api/lender/dashboard/payables?fy_year=${fyYear}`)
      .then(setData)
      .catch(() => {});
  }, [fyYear]);

  const toggleMonth = async (month: string) => {
    if (expandedMonth === month) {
      setExpandedMonth(null);
      setEntries([]);
      return;
    }
    setExpandedMonth(month);
    setLoadingEntries(true);
    try {
      const res = await api.get<{ entries: BillingEntry[] }>(`/api/lender/billing/entries?month=${month}`);
      setEntries(res.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const downloadCsv = async (month: string) => {
    try {
      const blob = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/lender/billing/export?month=${month}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lender-payables-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  if (!data) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const pieData = data.type_breakdown.map((t) => ({
    name: t.payable_type.replace(/_/g, " "),
    value: parseFloat(t.total_amount),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Pending" value={`\u20B9${parseFloat(data.totals.pending).toLocaleString()}`} icon={Clock} accentColor="amber" />
        <MetricCard label="Billed" value={`\u20B9${parseFloat(data.totals.billed).toLocaleString()}`} icon={FileCheck} accentColor="blue" />
        <MetricCard label="Paid" value={`\u20B9${parseFloat(data.totals.paid).toLocaleString()}`} icon={CircleDollarSign} accentColor="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Month-wise Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.month_wise.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Export</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.month_wise.map((row) => {
                    const status = row.invoice_status || "PENDING";
                    const isExpanded = expandedMonth === row.month;

                    return (
                      <Fragment key={row.month}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => toggleMonth(row.month)}
                        >
                          <TableCell>
                            <span className="mr-1 text-xs text-muted-foreground">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                            {row.month}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.invoice_number || "\u2014"}</TableCell>
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                          <TableCell className="text-right font-medium">\u20B9{parseFloat(row.total_amount).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <button
                              className="text-primary hover:text-primary/80 text-xs font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadCsv(row.month);
                              }}
                            >
                              CSV
                            </button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted px-4 py-3">
                              {loadingEntries ? (
                                <Skeleton className="h-8 w-full" />
                              ) : entries.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No entries</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Entry Type</TableHead>
                                      <TableHead className="text-xs">Report ID</TableHead>
                                      <TableHead className="text-xs text-right">Amount</TableHead>
                                      <TableHead className="text-xs text-right">Date</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {entries.map((entry) => (
                                      <TableRow key={entry.id}>
                                        <TableCell className="text-xs">{entry.entry_type.replace(/_/g, " ")}</TableCell>
                                        <TableCell className="text-xs font-mono">{entry.report_id.slice(0, 8)}...</TableCell>
                                        <TableCell className="text-xs text-right">\u20B9{parseFloat(entry.amount).toLocaleString()}</TableCell>
                                        <TableCell className="text-xs text-right">{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Type</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `\u20B9${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
