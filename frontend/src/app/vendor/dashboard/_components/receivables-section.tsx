"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorReceivablesResponse } from "@/types/dashboard";
import { BillingEntry } from "@/types/billing";

interface Props {
  fyYear: number;
}

export function ReceivablesSection({ fyYear }: Props) {
  const [data, setData] = useState<VendorReceivablesResponse | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    api.get<VendorReceivablesResponse>(`/api/vendor/dashboard/receivables?fy_year=${fyYear}`)
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
      const res = await api.get<{ entries: BillingEntry[] }>(`/api/vendor/billing/entries?month=${month}`);
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
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/vendor/billing/export?month=${month}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      ).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendor-receivables-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  if (!data) {
    return <Skeleton className="h-48 rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receivables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">By Lender</h4>
          {data.lender_wise.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lender_wise.map((row) => (
                    <TableRow key={row.lender_id}>
                      <TableCell>{row.lender_name}</TableCell>
                      <TableCell className="text-right font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Month-wise</h4>
          {data.month_wise.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <div className="overflow-x-auto">
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
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => toggleMonth(row.month)}
                        >
                          <TableCell>
                            <span className="mr-1 text-xs text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
                            {row.month}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.invoice_number || "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                          <TableCell className="text-right font-medium">₹{parseFloat(row.total_amount).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs h-auto p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadCsv(row.month);
                              }}
                            >
                              CSV
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted px-4 py-3">
                              {loadingEntries ? (
                                <p className="text-xs text-muted-foreground">Loading...</p>
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
                                        <TableCell className="text-xs text-right">₹{parseFloat(entry.amount).toLocaleString()}</TableCell>
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
