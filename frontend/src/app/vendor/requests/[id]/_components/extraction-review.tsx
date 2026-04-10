"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ContentJson, ExtractedField, Report } from "@/types/report";

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

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "bg-green-100 text-green-800";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
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

function PdfModal({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [reportId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] mx-4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Original Report PDF</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            &times;
          </button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Loading PDF...</p>
          </div>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} className="flex-1 w-full" title="Report PDF" />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-red-500">Failed to load PDF</p>
          </div>
        )}
      </div>
    </div>
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

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm";

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Extracted Report Data</h3>
        <button
          onClick={() => setShowPdf(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          View Original PDF
        </button>
      </div>

      {content && (
        <p className="text-xs text-gray-500">
          Extracted from {content.page_count} page(s) on{" "}
          {new Date(content.extracted_at).toLocaleDateString()}
        </p>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}

      {/* Anchor fields */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Key Fields</h4>
        <div className="space-y-3">
          {fields
            .filter((f) => f.isAnchor)
            .map((f) => {
              const globalIndex = fields.indexOf(f);
              const isRequired = REQUIRED_FIELDS.includes(f.key);
              return (
                <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-sm text-gray-600 sm:w-40 flex-shrink-0">
                    {FIELD_LABELS[f.key] || f.key}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={f.type === "number" || f.type === "currency" ? "number" : "text"}
                    className={inputClass}
                    value={f.value ?? ""}
                    onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                  />
                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ${confidenceColor(f.confidence)}`}
                  >
                    {confidenceLabel(f.confidence)} ({Math.round(f.confidence * 100)}%)
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Additional fields */}
      {fields.some((f) => !f.isAnchor) && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Fields</h4>
          <div className="space-y-3">
            {fields
              .filter((f) => !f.isAnchor)
              .map((f) => {
                const globalIndex = fields.indexOf(f);
                return (
                  <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-sm text-gray-600 sm:w-40 flex-shrink-0">
                      {FIELD_LABELS[f.key] || f.key.replace(/_/g, " ")}
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      value={f.value ?? ""}
                      onChange={(e) => updateFieldValue(globalIndex, e.target.value)}
                    />
                    <span
                      className={`text-xs px-2 py-1 rounded whitespace-nowrap ${confidenceColor(f.confidence)}`}
                    >
                      {confidenceLabel(f.confidence)} ({Math.round(f.confidence * 100)}%)
                    </span>
                    <button
                      onClick={() => removeField(globalIndex)}
                      className="text-red-400 hover:text-red-600 text-sm"
                      title="Remove field"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Add field */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Add Field</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Field name"
            className={`${inputClass} sm:w-40`}
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
          />
          <input
            type="text"
            placeholder="Value"
            className={inputClass}
            value={newFieldValue}
            onChange={(e) => setNewFieldValue(e.target.value)}
          />
          <button
            onClick={addField}
            disabled={!newFieldKey.trim()}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing || missingRequired.length > 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          title={
            missingRequired.length > 0
              ? `Missing: ${missingRequired.join(", ")}`
              : "Publish report"
          }
        >
          {publishing ? "Publishing..." : "Publish"}
        </button>
        {missingRequired.length > 0 && (
          <p className="text-xs text-red-500 self-center">
            Missing required: {missingRequired.join(", ")}
          </p>
        )}
      </div>

      {/* PDF Modal */}
      {showPdf && <PdfModal reportId={report.id} onClose={() => setShowPdf(false)} />}
    </div>
  );
}
