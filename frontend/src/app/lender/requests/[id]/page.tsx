"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequest } from "@/types/request";
import { StatusTimeline } from "./_components/status-timeline";
import DownloadButton from "@/components/download-button";
import { LenderReportPdfModal } from "./_components/lender-report-pdf-modal";

export default function LenderRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComments, setRejectComments] = useState("");
  const [error, setError] = useState("");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

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
      const updated = await api.get<ReportRequest>(`/api/lender/requests/${id}`);
      setRequest(updated);
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

  if (loading) return <p className="text-gray-500 py-8">Loading...</p>;
  if (!request) return <p className="text-red-500 py-8">{error || "Request not found"}</p>;

  const canAcceptReject = request.lender_status === "RECEIVED";
  const reportId = request.report_id ?? null;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.push("/lender/requests")}
        className="text-sm text-blue-600 hover:underline mb-4 block">&larr; Back to Requests</button>

      <h1 className="text-2xl font-bold mb-4">Request Detail</h1>

        {request.request_type !== "NEW" && (
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 ${
            request.request_type === "UPDATE"
              ? "bg-orange-100 text-orange-800"
              : "bg-blue-100 text-blue-800"
          }`}>
            {request.request_type === "UPDATE" ? "Update Request" : "Nearby Request"}
          </span>
        )}

        {request.parent_report_id && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Related Report</h3>
            <p className="text-sm text-gray-600">
              Report ID: {request.parent_report_id}
            </p>
            {request.request_type === "UPDATE" && request.comments && (() => {
              try {
                const parsed = JSON.parse(request.comments);
                if (parsed.checklist) {
                  return (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Update items:</p>
                      <ul className="text-sm text-gray-600 list-disc list-inside">
                        {parsed.checklist.map((item: string) => (
                          <li key={item}>{item.replace(/_/g, " ").toLowerCase()}</li>
                        ))}
                      </ul>
                      {parsed.text && <p className="text-sm text-gray-600 mt-1">{parsed.text}</p>}
                    </div>
                  );
                }
              } catch { /* plain text comments */ }
              return null;
            })()}
          </div>
        )}

      <StatusTimeline status={request.lender_status} />

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded mb-4 text-sm">{error}</div>
      )}

      {/* Property Details */}
      <div className="border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Property Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Address:</span> {request.property_address || "\u2014"}</div>
          <div><span className="text-gray-500">City:</span> {request.city}{request.area ? `, ${request.area}` : ""}</div>
          <div><span className="text-gray-500">Type:</span> {request.property_type}</div>
          <div><span className="text-gray-500">Category:</span> {request.report_category}</div>
          <div><span className="text-gray-500">Applicant:</span> {request.loan_applicant_name || "\u2014"}</div>
          <div><span className="text-gray-500">Price:</span> {request.price ? `\u20B9${request.price}` : "\u2014"}</div>
        </div>
      </div>

      {/* Report Actions */}
      {canAcceptReject && (
        <div className="border rounded-lg p-4 mb-4 bg-green-50">
          <h2 className="font-semibold mb-3">Report Uploaded</h2>
          <p className="text-sm text-gray-700 mb-4">The vendor has uploaded a report. You can accept or send it back for revision.</p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
            <button onClick={handleAccept} disabled={actionLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 min-h-11">
              {actionLoading ? "Processing..." : "Accept Report"}
            </button>
            <button onClick={() => setShowRejectDialog(true)} disabled={actionLoading}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 min-h-11">
              Send Back for Revision
            </button>
            {reportId ? (
              <>
                <button
                  type="button"
                  onClick={() => setPdfPreviewOpen(true)}
                  className="border border-gray-300 bg-white px-4 py-2 rounded-lg text-sm hover:bg-gray-50 min-h-11"
                >
                  View PDF
                </button>
                <DownloadButton
                  downloadUrl={`/api/reports/${reportId}/download`}
                  filename={`report-${reportId}.pdf`}
                  className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 min-h-11"
                />
              </>
            ) : (
              <p className="text-sm text-amber-800 self-center">
                Report file is not linked yet; refresh the page or contact support if this persists.
              </p>
            )}
          </div>
        </div>
      )}

      {request.lender_status === "ACCEPTED" && (
        <div className="border rounded-lg p-4 mb-4 bg-emerald-50">
          <p className="text-emerald-800 font-medium mb-3">Report accepted. Billing entries created.</p>
          {reportId ? (
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPdfPreviewOpen(true)}
                className="border border-emerald-200 bg-white px-4 py-2 rounded-lg text-sm text-emerald-900 hover:bg-emerald-100/80 min-h-11"
              >
                View PDF
              </button>
              <DownloadButton
                downloadUrl={`/api/reports/${reportId}/download`}
                filename={`report-${reportId}.pdf`}
                className="border border-emerald-200 bg-white px-4 py-2 rounded-lg text-sm text-emerald-900 hover:bg-emerald-100/80 min-h-11"
              />
            </div>
          ) : null}
        </div>
      )}

      {pdfPreviewOpen && reportId ? (
        <LenderReportPdfModal reportId={reportId} onClose={() => setPdfPreviewOpen(false)} />
      ) : null}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold mb-3">Send Back for Revision</h3>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
              rows={4}
              placeholder="Describe what needs to be revised..."
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectDialog(false)}
                className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading || !rejectComments.trim()}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? "Sending..." : "Send Back"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
