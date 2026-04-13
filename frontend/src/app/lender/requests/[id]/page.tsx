"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { StatusTimeline } from "./_components/status-timeline";
import DownloadButton from "@/components/download-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";

export default function LenderRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComments, setRejectComments] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<ReportRequest>(`/api/lender/requests/${id}`)
      .then(setRequest)
      .catch(() => setError("Request not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAccept = async () => {
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/lender/requests/${id}/accept`, {});
      setRequest((prev) => prev ? { ...prev, lender_status: "ACCEPTED", vendor_status: "ACCEPTED" } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectComments.trim()) return;
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/lender/requests/${id}/reject`, { comments: rejectComments });
      setRequest((prev) => prev ? { ...prev, lender_status: "SENT_FOR_REVIEW", vendor_status: "REVISION" } : prev);
      setShowRejectDialog(false);
      setRejectComments("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-muted-foreground py-8">Loading...</p>;
  if (!request) return <p className="text-destructive py-8">{error || "Request not found"}</p>;

  const canAcceptReject = request.lender_status === "RECEIVED";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.push("/lender/requests")}
        className="text-sm text-primary hover:underline mb-4 block">&larr; Back to Requests</button>

      <PageHeader title="Request Detail" />

        {request.request_type !== "NEW" && (
          <StatusBadge
            status={request.request_type}
            className="mb-2"
          />
        )}

        {request.parent_report_id && (
          <Card className="mb-4">
            <CardContent>
              <h3 className="text-sm font-medium text-foreground mb-1">Related Report</h3>
              <p className="text-sm text-muted-foreground">
                Report ID: {request.parent_report_id}
              </p>
              {request.request_type === "UPDATE" && request.comments && (() => {
                try {
                  const parsed = JSON.parse(request.comments);
                  if (parsed.checklist) {
                    return (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Update items:</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {parsed.checklist.map((item: string) => (
                            <li key={item}>{item.replace(/_/g, " ").toLowerCase()}</li>
                          ))}
                        </ul>
                        {parsed.text && <p className="text-sm text-muted-foreground mt-1">{parsed.text}</p>}
                      </div>
                    );
                  }
                } catch { /* plain text comments */ }
                return null;
              })()}
            </CardContent>
          </Card>
        )}

      <StatusTimeline status={request.lender_status} />

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* Property Details */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{request.property_address || "\u2014"}</span></div>
            <div><span className="text-muted-foreground">City:</span> <span className="text-foreground">{request.city}{request.area ? `, ${request.area}` : ""}</span></div>
            <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{request.property_type}</span></div>
            <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground">{request.report_category}</span></div>
            <div><span className="text-muted-foreground">Applicant:</span> <span className="text-foreground">{request.loan_applicant_name || "\u2014"}</span></div>
            <div><span className="text-muted-foreground">Price:</span> <span className="text-foreground">{request.price ? `\u20B9${request.price}` : "\u2014"}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Report Actions */}
      {canAcceptReject && (
        <Card className="mb-4 bg-emerald-50/50">
          <CardHeader>
            <CardTitle>Report Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">The vendor has uploaded a report. You can accept or send it back for revision.</p>
            <Separator className="mb-4" />
            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleAccept} disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {actionLoading ? "Processing..." : "Accept Report"}
              </Button>
              <Button variant="outline" onClick={() => setShowRejectDialog(true)} disabled={actionLoading}
                className="border-orange-300 text-orange-700 hover:bg-orange-50">
                Send Back for Revision
              </Button>
              <DownloadButton
                downloadUrl={`/api/reports/${id}/download`}
                filename={`report-${id}.pdf`}
                className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {request.lender_status === "ACCEPTED" && (
        <Card className="mb-4 bg-emerald-50/50">
          <CardContent>
            <p className="text-emerald-800 font-medium">Report accepted. Billing entries created.</p>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Send Back for Revision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={4}
                placeholder="Describe what needs to be revised..."
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReject} disabled={actionLoading || !rejectComments.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white">
                  {actionLoading ? "Sending..." : "Send Back"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
