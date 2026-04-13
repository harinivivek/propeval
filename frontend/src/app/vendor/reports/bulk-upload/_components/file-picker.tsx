"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import type { BulkUploadJob } from "@/types/bulk-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

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
        <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">{error}</div>
      )}

      <div>
        <Label className="mb-1">Report Category</Label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "VALUATION" | "LEGAL")}
          className="flex h-9 w-auto rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      <Card className="border-2 border-dashed">
        <CardContent className="p-6 text-center">
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
            id="bulk-file-input"
          />
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <label
            htmlFor="bulk-file-input"
            className="cursor-pointer text-primary hover:underline text-sm font-medium"
          >
            Click to select PDF files
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            Max 50 files per batch, 20MB each
          </p>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            {files.length} file(s) selected
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center justify-between bg-muted px-3 py-2 rounded-md text-sm"
              >
                <span className="truncate text-foreground">{f.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-muted-foreground text-xs">
                    {(f.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-destructive/60 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
      >
        <Upload className="h-4 w-4 mr-2" />
        {uploading ? "Uploading..." : `Upload ${files.length} File(s)`}
      </Button>
    </div>
  );
}
