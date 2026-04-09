"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Report } from "@/types/report";

type Props = {
  requestId: string;
  isRevision?: boolean;
  onUploaded: () => void;
};

export function UploadSection({ requestId, isRevision = false, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [valuationAmount, setValuationAmount] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [comments, setComments] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    if (valuationAmount) formData.append("valuation_amount", valuationAmount);
    if (reportDate) formData.append("report_date", reportDate);
    if (isRevision && comments) formData.append("comments", comments);

    try {
      const endpoint = isRevision
        ? `/api/vendor/requests/${requestId}/revise`
        : `/api/vendor/requests/${requestId}/upload`;
      await api.upload<Report>(endpoint, formData);
      onUploaded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm";

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold">
        {isRevision ? "Re-upload Revised Report" : "Upload Report"}
      </h3>

      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Report PDF *</label>
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">PDF only, max 20MB</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Amount</label>
          <input type="number" className={inputClass} value={valuationAmount}
            onChange={(e) => setValuationAmount(e.target.value)} placeholder="e.g. 5000000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Date</label>
          <input type="date" className={inputClass} value={reportDate}
            onChange={(e) => setReportDate(e.target.value)} />
        </div>
      </div>

      {isRevision && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Revision Comments</label>
          <textarea className={inputClass} rows={3} value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Describe what was changed..." />
        </div>
      )}

      <button onClick={handleUpload} disabled={!file || uploading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
        {uploading ? "Uploading..." : isRevision ? "Submit Revision" : "Upload Report"}
      </button>
    </div>
  );
}
