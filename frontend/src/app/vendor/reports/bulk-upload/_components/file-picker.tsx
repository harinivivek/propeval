"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { vendorReportUploadDate } from "@/lib/vendor-report-upload-date";
import type { BulkUploadJob } from "@/types/bulk-upload";

type Props = {
  onJobCreated: (job: BulkUploadJob) => void;
};

export function FilePicker({ onJobCreated }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<"VALUATION" | "LEGAL">("VALUATION");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const pdfs = selected.filter((f) => f.type === "application/pdf");
    if (pdfs.length !== selected.length) {
      setError("Some files were skipped — only PDFs are accepted.");
    }
    if (pdfs.length > 50) {
      setError("Maximum 50 files per batch. Please select fewer files.");
      return;
    }
    setFiles(pdfs);
    if (pdfs.length === selected.length) setError("");
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("report_category", category);
    formData.append("report_date", vendorReportUploadDate());

    try {
      const job = await api.upload<BulkUploadJob>(
        "/api/vendor/reports/bulk-upload",
        formData
      );
      onJobCreated(job);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Report Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "VALUATION" | "LEGAL")}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
          id="bulk-file-input"
        />
        <label
          htmlFor="bulk-file-input"
          className="cursor-pointer text-blue-600 hover:underline text-sm"
        >
          Click to select PDF files
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Max 50 files per batch, 20MB each
        </p>
      </div>

      {files.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            {files.length} file(s) selected
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
              >
                <span className="truncate">{f.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-400 text-xs">
                    {(f.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-red-400 hover:text-red-600"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : `Upload ${files.length} File(s)`}
      </button>
    </div>
  );
}
