"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import type { BulkUploadJob, BulkUploadReportStatus } from "@/types/bulk-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/metric-card";

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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-destructive py-8">Job not found</p>
      </div>
    );
  }

  const progress =
    job.total_reports > 0
      ? Math.round(((job.processed_count + job.failed_count) / job.total_reports) * 100)
      : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/vendor/reports/bulk-upload")}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Bulk Upload
      </Button>

      <PageHeader title="Bulk Upload Progress" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total" value={job.total_reports} icon={FileText} accentColor="blue" />
        <MetricCard label="Processed" value={job.processed_count} icon={CheckCircle2} accentColor="emerald" />
        <MetricCard label="Failed" value={job.failed_count} icon={AlertTriangle} accentColor="red" />
        <MetricCard label="Complete" value={`${progress}%`} icon={FileText} accentColor="purple" />
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {(job.status === "IN_PROGRESS" || job.status === "PENDING") && (
            <p className="text-sm text-primary mt-2 text-center">Processing...</p>
          )}
          {job.status === "COMPLETED" && (
            <p className="text-sm text-emerald-600 mt-2 text-center">All reports processed.</p>
          )}
          {job.status === "PARTIALLY_FAILED" && (
            <p className="text-sm text-amber-600 mt-2 text-center">
              Completed with {job.failed_count} failure(s).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {reports.map((r) => (
              <div key={r.report_id} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm truncate text-foreground">
                    {r.property_address || r.report_id}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
