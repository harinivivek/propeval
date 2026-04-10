"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { BulkUploadJob, BulkUploadReportStatus } from "@/types/bulk-upload";

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  EXTRACTION_FAILED: "bg-red-100 text-red-700",
  READY_TO_PUBLISH: "bg-green-100 text-green-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
};

export default function BulkJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<BulkUploadJob | null>(null);
  const [reports, setReports] = useState<BulkUploadReportStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [jobData, reportData] = await Promise.all([
        api.get<BulkUploadJob>(`/api/vendor/reports/bulk-jobs/${id}`),
        api.get<BulkUploadReportStatus[]>(`/api/vendor/reports/bulk-jobs/${id}/reports`),
      ]);
      setJob(jobData);
      setReports(reportData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!job || job.status === "COMPLETED" || job.status === "PARTIALLY_FAILED") return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [job?.status]);

  if (loading) return <p className="text-gray-500 py-8">Loading...</p>;
  if (!job) return <p className="text-red-500 py-8">Job not found</p>;

  const progress =
    job.total_reports > 0
      ? Math.round(((job.processed_count + job.failed_count) / job.total_reports) * 100)
      : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => router.push("/vendor/reports/bulk-upload")}
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        &larr; Back to Bulk Upload
      </button>

      <h1 className="text-2xl font-bold mb-4">Bulk Upload Progress</h1>

      <div className="border rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{job.total_reports}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{job.processed_count}</p>
            <p className="text-xs text-gray-500">Processed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{job.failed_count}</p>
            <p className="text-xs text-gray-500">Failed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{progress}%</p>
            <p className="text-xs text-gray-500">Complete</p>
          </div>
        </div>

        <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {(job.status === "IN_PROGRESS" || job.status === "PENDING") && (
          <p className="text-sm text-blue-600 mt-2 text-center">Processing...</p>
        )}
        {job.status === "COMPLETED" && (
          <p className="text-sm text-green-600 mt-2 text-center">All reports processed.</p>
        )}
        {job.status === "PARTIALLY_FAILED" && (
          <p className="text-sm text-amber-600 mt-2 text-center">
            Completed with {job.failed_count} failure(s).
          </p>
        )}
      </div>

      <div className="border rounded-lg divide-y">
        <div className="px-4 py-3 bg-gray-50">
          <h3 className="font-semibold text-sm">Reports</h3>
        </div>
        {reports.map((r) => (
          <div key={r.report_id} className="px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm truncate">
                {r.property_address || r.report_id}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded flex-shrink-0 ${STATUS_COLORS[r.status] || "bg-gray-100"}`}
            >
              {r.status.replace(/_/g, " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
