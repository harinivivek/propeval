"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface QueueItem {
  id: string;
  report_id: string;
  status: string;
  feedback_text: string | null;
  reviewed_at: string | null;
  created_at: string;
  report: {
    id: string;
    filename: string | null;
    status: string | null;
    property_type: string | null;
    city: string | null;
    created_at: string;
  };
}

interface QueueResponse {
  items: QueueItem[];
  total: number;
  page: number;
  page_size: number;
}

export default function AdminQualityReviewsPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [activeReview, setActiveReview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get<QueueResponse>(`/api/admin/quality-reviews?${params}`);
      setData(res);
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchQueue(); }, [statusFilter]);

  const handleDecision = async (reviewId: string, decision: string) => {
    if ((decision === "RETURNED" || decision === "FLAGGED") && !feedback.trim()) {
      toast.error("Feedback is required for this decision");
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/api/admin/quality-reviews/${reviewId}`, {
        decision,
        feedback_text: feedback || null,
      });
      toast.success(`Review ${decision.toLowerCase()}`);
      setActiveReview(null);
      setFeedback("");
      fetchQueue();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Quality Review Queue</h1>
        <div className="flex gap-2">
          {["PENDING", "APPROVED", "RETURNED", "FLAGGED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-sm rounded-full border ${
                statusFilter === s ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No reviews in queue.</div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <div key={item.id} className="bg-white border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      item.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                      item.status === "APPROVED" ? "bg-green-100 text-green-700" :
                      item.status === "RETURNED" ? "bg-orange-100 text-orange-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {item.status}
                    </span>
                    <span className="text-sm font-medium">{item.report.property_type}</span>
                    <span className="text-sm text-muted-foreground">{item.report.city}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Report: {item.report.filename || item.report_id.slice(0, 8)} | Submitted: {new Date(item.created_at).toLocaleDateString()}
                  </div>
                  {item.feedback_text && (
                    <p className="text-sm mt-2 bg-gray-50 p-2 rounded">{item.feedback_text}</p>
                  )}
                </div>

                {item.status === "PENDING" && (
                  <div className="flex items-start gap-2 flex-shrink-0">
                    {activeReview === item.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Feedback (required for Return/Flag)"
                          className="w-full border rounded p-2 text-sm min-w-[200px]"
                          rows={2}
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDecision(item.id, "APPROVED")}
                            disabled={submitting}
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(item.id, "RETURNED")}
                            disabled={submitting}
                            className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 disabled:opacity-50"
                          >
                            Return
                          </button>
                          <button
                            onClick={() => handleDecision(item.id, "FLAGGED")}
                            disabled={submitting}
                            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                          >
                            Flag
                          </button>
                          <button
                            onClick={() => { setActiveReview(null); setFeedback(""); }}
                            className="border px-3 py-1 rounded text-xs hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveReview(item.id)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                      >
                        Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
