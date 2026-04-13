"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PurchasedReportsResponse } from "@/types/listing";
import { UpdateRequestDialog } from "../[id]/_components/update-request-dialog";
import DownloadButton from "@/components/download-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PurchasedReportsPage() {
  const [data, setData] = useState<PurchasedReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [updateReportId, setUpdateReportId] = useState<string | null>(null);
  const [updateReportMeta, setUpdateReportMeta] = useState<{category: string; address: string | null; date: string | null} | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<PurchasedReportsResponse>(
          `/api/lender/listings/purchases?page=${page}`
        );
        setData(res);
      } catch {
        setError("Failed to load purchases");
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [page]);

  return (
    <div>
      <PageHeader title="Purchased Reports" />

      {error && <p className="text-destructive mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Purchased</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                      <TableHead className="text-right">Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.purchase.id}>
                        <TableCell>{item.report.property_address || "—"}</TableCell>
                        <TableCell>{item.report.city || "—"}</TableCell>
                        <TableCell>{item.report.property_type || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.report.report_category}</Badge>
                        </TableCell>
                        <TableCell>{new Date(item.purchase.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">₹{item.purchase.price}</TableCell>
                        <TableCell className="text-right">
                          <DownloadButton
                            downloadUrl={`/api/lender/listings/purchases/${item.purchase.id}/download`}
                            filename={`report-${item.report.id}.pdf`}
                            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 disabled:opacity-50"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => {
                              setUpdateReportId(item.report.id);
                              setUpdateReportMeta({
                                category: item.report.report_category,
                                address: item.report.property_address,
                                date: item.report.report_date,
                              });
                            }}
                            variant="outline"
                            size="sm"
                          >
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.items.map((item) => (
              <Card key={item.purchase.id}>
                <CardContent>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm text-foreground">{item.report.property_address || "—"}</p>
                      <p className="text-xs text-muted-foreground">{item.report.city} · {item.report.property_type}</p>
                    </div>
                    <Badge variant="secondary">{item.report.report_category}</Badge>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">₹{item.purchase.price}</span>
                      <span className="text-muted-foreground/60 ml-2">{new Date(item.purchase.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setUpdateReportId(item.report.id);
                          setUpdateReportMeta({
                            category: item.report.report_category,
                            address: item.report.property_address,
                            date: item.report.report_date,
                          });
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Update
                      </Button>
                      <DownloadButton
                        downloadUrl={`/api/lender/listings/purchases/${item.purchase.id}/download`}
                        filename={`report-${item.report.id}.pdf`}
                        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data.total > data.page_size && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="px-3 py-2 text-sm text-muted-foreground">
                Page {page} of {Math.ceil(data.total / data.page_size)}
              </span>
              <Button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.page_size >= data.total}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">No purchased reports yet. Browse the <a href="/lender/listings" className="text-primary hover:underline">listings marketplace</a> to find reports.</p>
      )}
      {updateReportId && updateReportMeta && (
        <UpdateRequestDialog
          reportId={updateReportId}
          reportCategory={updateReportMeta.category}
          locality={updateReportMeta.address}
          reportDate={updateReportMeta.date}
          onSuccess={() => {
            setUpdateReportId(null);
            setUpdateReportMeta(null);
            window.location.href = "/lender/requests";
          }}
          onCancel={() => {
            setUpdateReportId(null);
            setUpdateReportMeta(null);
          }}
        />
      )}
    </div>
  );
}
