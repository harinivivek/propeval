"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ContentJson, ExtractedField, Report } from "@/types/report";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  report: Report;
  onUpdated: () => void;
};

const FIELD_LABELS: Record<string, string> = {
  property_address: "Property Address",
  property_type: "Property Type",
  valuation_amount: "Valuation Amount",
  built_up_area: "Built-up Area",
  owner_name: "Owner Name",
};

const REQUIRED_FIELDS = ["property_address", "property_type", "valuation_amount"];

function confidenceBadge(confidence: number) {
  if (confidence >= 0.9) {
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">High ({Math.round(confidence * 100)}%)</Badge>;
  }
  if (confidence >= 0.6) {
    return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">Medium ({Math.round(confidence * 100)}%)</Badge>;
  }
  return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">Low ({Math.round(confidence * 100)}%)</Badge>;
}

type FieldEntry = {
  key: string;
  value: string | number | null;
  confidence: number;
  type: string;
  original?: string | number | null;
  edited?: boolean;
  isAnchor: boolean;
};

function flattenFields(content: ContentJson): FieldEntry[] {
  const entries: FieldEntry[] = [];
  for (const [key, field] of Object.entries(content.anchor_fields)) {
    entries.push({ key, ...field, isAnchor: true });
  }
  for (const [key, field] of Object.entries(content.additional_fields)) {
    entries.push({ key, ...field, isAnchor: false });
  }
  return entries;
}

function PdfModal({ reportId, open, onClose }: { reportId: string; open: boolean; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem("access_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020";

    fetch(`${apiUrl}/api/vendor/reports/${reportId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load PDF");
        return res.blob();
      })
      .then((blob) => {
        setPdfUrl(URL.createObjectURL(blob));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [reportId, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Original Report PDF</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 p-4 pt-2">
          {loading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <Skeleton className="w-full h-full" />
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full rounded-md border" title="Report PDF" />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <p className="text-destructive">Failed to load PDF</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExtractionReview({ report, onUpdated }: Props) {
  const content = report.content_json;
  const [fields, setFields] = useState<FieldEntry[]>(
    content ? flattenFields(content) : []
  );
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [showPdf, setShowPdf] = useState(false);

  const updateFieldValue = (index: number, newValue: string) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const original = f.original ?? f.value;
        return {
          ...f,
          value: newValue,
          original: f.edited ? f.original : original,
          edited: true,
        };
      })
    );
  };

  const addField = () => {
    if (!newFieldKey.trim()) return;
    setFields((prev) => [
      ...prev,
      {
        key: newFieldKey.trim().toLowerCase().replace(/\s+/g, "_"),
        value: newFieldValue,
        confidence: 1.0,
        type: "text",
        edited: false,
        isAnchor: false,
      },
    ]);
    setNewFieldKey("");
    setNewFieldValue("");
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    const anchor: Record<string, object> = {};
    const additional: Record<string, object> = {};

    for (const f of fields) {
      const data = {
        value: f.value,
        confidence: f.confidence,
        type: f.type,
        original: f.original ?? null,
        edited: f.edited ?? false,
      };
      if (f.isAnchor || f.key in (content?.anchor_fields ?? {})) {
        anchor[f.key] = data;
      } else {
        additional[f.key] = data;
      }
    }
    return { anchor_fields: anchor, additional_fields: additional };
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/vendor/reports/${report.id}/extracted-data`, buildPayload());
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError("");
    try {
      await api.put(`/api/vendor/reports/${report.id}/extracted-data`, buildPayload());
      await api.post(`/api/vendor/reports/${report.id}/publish`, {});
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const missingRequired = REQUIRED_FIELDS.filter((f) => {
    const field = fields.find((entry) => entry.key === f);
    return !field || !field.value;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Extracted Report Data</CardTitle>
        <Button variant="link" onClick={() => setShowPdf(true)} className="text-primary">
          View Original PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {content && (
          <p className="text-xs text-muted-foreground">
            Extracted from {content.page_count} page(s) on{" "}
            {new Date(content.extracted_at).toLocaleDateString()}
          </p>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">{error}</div>
        )}

        {/* Anchor fields */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Key Fields</h4>
          <div className="space-y-3">
            {fields
              .filter((f) => f.isAnchor)
              .map((f) => {
                const globalIndex = fields.indexOf(f);
                const isRequired = REQUIRED_FIELDS.includes(f.key);
                return (
                  <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Label className="sm:w-40 flex-shrink-0">
                      {FIELD_LABELS[f.key] || f.key}
                      {isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      type={f.type === "number" || f.type === "currency" ? "number" : "text"}
                      value={f.value ?? ""}
                      onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                    />
                    {confidenceBadge(f.confidence)}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Additional fields */}
        {fields.some((f) => !f.isAnchor) && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Additional Fields</h4>
            <div className="space-y-3">
              {fields
                .filter((f) => !f.isAnchor)
                .map((f) => {
                  const globalIndex = fields.indexOf(f);
                  return (
                    <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Label className="sm:w-40 flex-shrink-0">
                        {FIELD_LABELS[f.key] || f.key.replace(/_/g, " ")}
                      </Label>
                      <Input
                        type="text"
                        value={f.value ?? ""}
                        onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                      />
                      {confidenceBadge(f.confidence)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(globalIndex)}
                        className="text-destructive hover:text-destructive"
                        title="Remove field"
                      >
                        &times;
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Add field */}
        <Separator />
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Add Field</h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Field name"
              className="sm:w-40"
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
            />
            <Input
              placeholder="Value"
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={addField}
              disabled={!newFieldKey.trim()}
              className="whitespace-nowrap"
            >
              + Add
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing || missingRequired.length > 0}
            title={
              missingRequired.length > 0
                ? `Missing: ${missingRequired.join(", ")}`
                : "Publish report"
            }
          >
            {publishing ? "Publishing..." : "Publish"}
          </Button>
          {missingRequired.length > 0 && (
            <p className="text-xs text-destructive self-center">
              Missing required: {missingRequired.join(", ")}
            </p>
          )}
        </div>

        {/* PDF Modal */}
        <PdfModal reportId={report.id} open={showPdf} onClose={() => setShowPdf(false)} />
      </CardContent>
    </Card>
  );
}
