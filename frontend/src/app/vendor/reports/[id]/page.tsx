"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";

export default function VendorReportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setReport(null);
    const fetchReport = async () => {
      try {
        const data = await api.get<Record<string, unknown>>(
          `/api/vendor/reports/${id}`,
        );
        setReport(data);
      } catch (error) {
        console.error("Failed to fetch report detail:", error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!report) {
    return <div className="p-8 text-center">Report not found.</div>;
  }

  const contentJson = report.content_json as
    | {
        anchor_fields?: Record<string, { value?: string }>;
        additional_fields?: Record<string, { value?: string }>;
      }
    | undefined;
  const anchorFields = contentJson?.anchor_fields || {};
  const additionalFields = contentJson?.additional_fields || {};
  const propertyAddress =
    typeof report.property_address === "string"
      ? report.property_address
      : "";
  const status = typeof report.status === "string" ? report.status : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/vendor/reports"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{propertyAddress || "Report"}</h1>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {status}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">ID: {id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Extracted Anchor Fields
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {Object.entries(anchorFields).map(([key, field]) => (
              <div key={key} className="border-b pb-2 last:border-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="text-base">{field.value || "N/A"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Additional Extracted Info</h3>
          </div>
          <div className="p-6 space-y-4">
            {Object.keys(additionalFields).length > 0 ? (
              Object.entries(additionalFields).map(([key, field]) => (
                <div key={key} className="border-b pb-2 last:border-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="text-base">{field.value || "N/A"}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic text-sm">
                No additional fields extracted from this document.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
