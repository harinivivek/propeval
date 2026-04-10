"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReportRequest, RejectionReason } from "@/types/request";
import type { Report } from "@/types/report";
import { ExtractionReview } from "./_components/extraction-review";
import { UploadSection } from "./_components/upload-section";

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

  if (loading) return <p className="text-gray-500 py-8">Loading...</p>;
  if (!request) return <p className="text-red-500 py-8">{error || "Request not found"}</p>;

  const isIncoming = request.vendor_status === "INCOMING";
  const isPending = request.vendor_status === "PENDING";
  const isRevision = request.vendor_status === "REVISION";
  const isCompleted = request.vendor_status === "SENT" || request.vendor_status === "ACCEPTED";

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.push("/vendor/requests")}
        className="text-sm text-blue-600 hover:underline mb-4 block">&larr; Back to Requests</button>

      <h1 className="text-2xl font-bold mb-4">Request Detail</h1>

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
        {request.comments && (
          <div className="mt-3 pt-3 border-t">
            <span className="text-gray-500 text-sm">Comments:</span>
            <p className="text-sm mt-1">{request.comments}</p>
          </div>
        )}
      </div>

      {/* Incoming: Accept/Reject */}
      {isIncoming && (
        <div className="border rounded-lg p-4 mb-4 bg-blue-50">
          <h2 className="font-semibold mb-3">Action Required</h2>
          <p className="text-sm text-gray-700 mb-4">You have a new request. Accept to proceed or reject with a reason.</p>
          <div className="flex gap-3">
            <button onClick={handleAccept} disabled={actionLoading}
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              {actionLoading ? "Processing..." : "Accept"}
            </button>
            <button onClick={() => setShowRejectDialog(true)} disabled={actionLoading}
              className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Pending: Upload */}
      {isPending && (
        <UploadSection requestId={id} onUploaded={fetchRequest} />
      )}

      {/* Revision: Re-upload */}
      {isRevision && (
        <>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-orange-800 mb-2">Revision Requested</h3>
            <p className="text-sm text-orange-700">The lender has requested revisions. Please re-upload an updated report.</p>
          </div>
          <UploadSection requestId={id} isRevision onUploaded={fetchRequest} />
        </>
      )}

      {/* Report Status (after upload) */}
      {isCompleted && report && (
        <>
          {report.status === "PROCESSING" && (
            <div className="border rounded-lg p-4 mb-4 bg-blue-50">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                <div>
                  <p className="font-medium text-blue-800">Extracting report data...</p>
                  <p className="text-sm text-blue-600">This usually takes 30-60 seconds.</p>
                </div>
              </div>
            </div>
          )}

          {report.status === "EXTRACTION_FAILED" && (
            <div className="border rounded-lg p-4 mb-4 bg-red-50">
              <h3 className="font-semibold text-red-800 mb-2">Extraction Failed</h3>
              <p className="text-sm text-red-700 mb-3">
                We couldn&apos;t extract data from this report. You can retry or fill in the fields manually.
              </p>
              <button
                onClick={async () => {
                  try {
                    await api.post(`/api/vendor/reports/${report.id}/retry-extraction`, {});
                    fetchReport();
                  } catch {}
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
              >
                Retry Extraction
              </button>
            </div>
          )}

          {(report.status === "READY_TO_PUBLISH" || report.status === "PUBLISHED") && (
            <ExtractionReview report={report} onUpdated={fetchReport} />
          )}

          {report.status === "UPLOADED" && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50">
              <p className="text-gray-600">Report uploaded. Waiting for processing to start...</p>
            </div>
          )}
        </>
      )}

      {/* Completed (no report yet) */}
      {isCompleted && !report && (
        <div className="border rounded-lg p-4 mb-4 bg-emerald-50">
          <p className="text-emerald-800 font-medium">
            {request.vendor_status === "ACCEPTED" ? "Report accepted by lender." : "Report submitted."}
          </p>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold mb-3">Reject Request</h3>
            <div className="space-y-2 mb-4">
              {REJECTION_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={r.value}
                    checked={rejectReason === r.value}
                    onChange={() => setRejectReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
            {rejectReason === "LOW_PRICE" && (
              <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded mb-4">
                Consider discussing pricing with the lender before rejecting.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectDialog(false)}
                className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {actionLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
