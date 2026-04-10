"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const CHECKLIST_ITEMS: Record<string, string> = {
  RECHECK_VALUATION: "Recheck valuation amount",
  VERIFY_BOUNDARIES: "Verify property boundaries",
  UPDATE_PHOTOS: "Update property photos",
  VERIFY_OCCUPANCY: "Verify current occupancy",
  UPDATE_CONSTRUCTION: "Update construction status",
  VERIFY_LEGAL_STATUS: "Verify legal/title status",
  OTHER: "Other (see comments)",
};

interface Props {
  reportId: string;
  reportCategory: string;
  locality: string | null;
  reportDate: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UpdateRequestDialog({
  reportId,
  reportCategory,
  locality,
  reportDate,
  onSuccess,
  onCancel,
}: Props) {
  const [checklist, setChecklist] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleItem = (key: string) => {
    setChecklist((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    if (checklist.length === 0) {
      setError("Please select at least one update item");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/api/lender/requests/update", {
        report_id: reportId,
        checklist,
        comments: comments || null,
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create update request";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-1">Request Report Update</h3>
        <p className="text-sm text-gray-500 mb-4">
          {reportCategory} report{locality ? ` · ${locality}` : ""}
          {reportDate ? ` · ${reportDate}` : ""}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What needs updating?
          </label>
          <div className="space-y-2">
            {Object.entries(CHECKLIST_ITEMS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.includes(key)}
                  onChange={() => toggleItem(key)}
                  className="rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional comments
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder="Any specific instructions for the vendor..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Price per your lender pricing agreement.
        </p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Update Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
