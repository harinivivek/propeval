"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequest, RejectionReason } from "@/types/request";
import type { Report } from "@/types/report";
import { ExtractionReview } from "./_components/extraction-review";
import { UploadSection } from "./_components/upload-section";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: "LOW_PRICE", label: "Price too low" },
  { value: "NOT_AVAILABLE", label: "Not available" },
  { value: "DO_NOT_WANT_TO_SHARE", label: "Don't want to share" },
];

export default function VendorRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason>("LOW_PRICE");
  const [error, setError] = useState("");

  const fetchRequest = () => {
    api
      .get<ReportRequest>(`/api/vendor/requests/${id}`)
      .then(setRequest)
      .catch(() => setError("Request not found"))
      .finally(() => setLoading(false));
  };

  const fetchReport = () => {
    api
      .get<Report>(`/api/vendor/requests/${id}/report`)
      .then(setReport)
      .catch(() => {}); // Report may not exist yet
  };

  useEffect(() => { fetchRequest(); }, [id]);

  useEffect(() => {
    if (request?.vendor_status === "SENT" || request?.vendor_status === "ACCEPTED") {
      fetchReport();
      const interval = setInterval(fetchReport, 5000);
      return () => clearInterval(interval);
    }
  }, [request?.vendor_status]);

  const handleAccept = async () => {
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/vendor/requests/${id}/accept`, {});
      setRequest((prev) => prev ? { ...prev, vendor_status: "PENDING", lender_status: "AWAITED" } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/vendor/requests/${id}/reject`, { reason: rejectReason });
      setShowRejectDialog(false);
      router.push("/vendor/requests");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-destructive py-8">{error || "Request not found"}</p>
      </div>
    );
  }

  const isIncoming = request.vendor_status === "INCOMING";
  const isPending = request.vendor_status === "PENDING";
  const isRevision = request.vendor_status === "REVISION";
  const isCompleted = request.vendor_status === "SENT" || request.vendor_status === "ACCEPTED";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button
        variant="link"
        onClick={() => router.push("/vendor/requests")}
        className="px-0 text-primary"
      >
        &larr; Back to Requests
      </Button>

      <PageHeader title="Request Detail" />

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      )}

      {request.parent_report_id && (request.request_type === "UPDATE" || request.request_type === "NEARBY") && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-800">
              {request.request_type === "UPDATE"
                ? "Update request for previous report"
                : "Nearby property request"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-900 space-y-1">
            <p><span className="font-medium">Original property:</span> {request.property_address}</p>
            <p><span className="font-medium">City:</span> {request.city} &middot; {request.pin_code || ""}</p>
            <p><span className="font-medium">Type:</span> {request.property_type} &middot; {request.report_category}</p>

            {request.request_type === "UPDATE" && request.comments && (() => {
              try {
                const parsed = JSON.parse(request.comments);
                if (parsed.checklist) {
                  return (
                    <div className="mt-3 border-t border-amber-200 pt-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Lender requested updates:</p>
                      <ul className="text-sm text-amber-900 space-y-1">
                        {parsed.checklist.map((item: string) => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="text-amber-500">&#9679;</span>
                            {item.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </li>
                        ))}
                      </ul>
                      {parsed.text && (
                        <p className="text-sm text-amber-900 mt-2 italic">&quot;{parsed.text}&quot;</p>
                      )}
                    </div>
                  );
                }
              } catch { /* plain text comments */ }
              return null;
            })()}
          </CardContent>
        </Card>
      )}

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Address:</span> {request.property_address || "\u2014"}</div>
            <div><span className="text-muted-foreground">City:</span> {request.city}{request.area ? `, ${request.area}` : ""}</div>
            <div><span className="text-muted-foreground">Type:</span> {request.property_type}</div>
            <div><span className="text-muted-foreground">Category:</span> {request.report_category}</div>
            <div><span className="text-muted-foreground">Applicant:</span> {request.loan_applicant_name || "\u2014"}</div>
            <div><span className="text-muted-foreground">Price:</span> {request.price ? `\u20B9${request.price}` : "\u2014"}</div>
          </div>
          {request.comments && (
            <div className="mt-3 pt-3 border-t border-border">
              <span className="text-muted-foreground text-sm">Comments:</span>
              <p className="text-sm mt-1">{request.comments}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incoming: Accept/Reject */}
      {isIncoming && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">You have a new request. Accept to proceed or reject with a reason.</p>
            <div className="flex gap-3">
              <Button onClick={handleAccept} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
                {actionLoading ? "Processing..." : "Accept"}
              </Button>
              <Button variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={actionLoading}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending: Upload */}
      {isPending && (
        <UploadSection requestId={id} onUploaded={fetchRequest} />
      )}

      {/* Revision: Re-upload */}
      {isRevision && (
        <>
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-orange-800">Revision Requested</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-700">The lender has requested revisions. Please re-upload an updated report.</p>
            </CardContent>
          </Card>
          <UploadSection requestId={id} isRevision onUploaded={fetchRequest} />
        </>
      )}

      {/* Report Status (after upload) */}
      {isCompleted && report && (
        <>
          {report.status === "PROCESSING" && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                  <div>
                    <p className="font-medium text-primary">Extracting report data...</p>
                    <p className="text-sm text-muted-foreground">This usually takes 30-60 seconds.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {report.status === "EXTRACTION_FAILED" && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-destructive">Extraction Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-destructive/80 mb-3">
                  We couldn&apos;t extract data from this report. You can retry or fill in the fields manually.
                </p>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await api.post(`/api/vendor/reports/${report.id}/retry-extraction`, {});
                      fetchReport();
                    } catch {}
                  }}
                >
                  Retry Extraction
                </Button>
              </CardContent>
            </Card>
          )}

          {(report.status === "READY_TO_PUBLISH" || report.status === "PUBLISHED") && (
            <ExtractionReview report={report} onUpdated={fetchReport} />
          )}

          {report.status === "UPLOADED" && (
            <Card className="bg-muted">
              <CardContent className="py-4">
                <p className="text-muted-foreground">Report uploaded. Waiting for processing to start...</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Completed (no report yet) */}
      {isCompleted && !report && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-4">
            <p className="text-emerald-800 font-medium">
              {request.vendor_status === "ACCEPTED" ? "Report accepted by lender." : "Report submitted."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>Select a reason for rejecting this request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {REJECTION_REASONS.map((r) => (
              <Label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="reason" value={r.value}
                  checked={rejectReason === r.value}
                  onChange={() => setRejectReason(r.value)}
                  className="accent-primary"
                />
                {r.label}
              </Label>
            ))}
          </div>
          {rejectReason === "LOW_PRICE" && (
            <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded-md">
              Consider discussing pricing with the lender before rejecting.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
