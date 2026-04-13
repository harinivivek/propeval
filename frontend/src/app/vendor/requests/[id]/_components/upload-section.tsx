"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Report } from "@/types/report";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRevision ? "Re-upload Revised Report" : "Upload Report"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="report-pdf">Report PDF *</Label>
          <Input
            id="report-pdf"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <p className="text-xs text-muted-foreground">PDF only, max 20MB</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="valuation-amount">Valuation Amount</Label>
            <Input
              id="valuation-amount"
              type="number"
              value={valuationAmount}
              onChange={(e) => setValuationAmount(e.target.value)}
              placeholder="e.g. 5000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-date">Report Date</Label>
            <Input
              id="report-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>
        </div>

        {isRevision && (
          <div className="space-y-2">
            <Label htmlFor="revision-comments">Revision Comments</Label>
            <Textarea
              id="revision-comments"
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Describe what was changed..."
            />
          </div>
        )}

        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "Uploading..." : isRevision ? "Submit Revision" : "Upload Report"}
        </Button>
      </CardContent>
    </Card>
  );
}
