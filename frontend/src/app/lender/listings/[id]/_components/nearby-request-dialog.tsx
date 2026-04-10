"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  referenceReportId: string;
  listingCity: string;
  listingPinCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NearbyRequestDialog({
  referenceReportId,
  listingCity,
  listingPinCode,
  onSuccess,
  onCancel,
}: Props) {
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState(listingCity);
  const [pinCode, setPinCode] = useState(listingPinCode);
  const [area, setArea] = useState("");
  const [reportCategory, setReportCategory] = useState("VALUATION");
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!propertyAddress.trim()) {
      setError("Property address is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/api/lender/requests/nearby", {
        report_id: referenceReportId,
        property_address: propertyAddress,
        city,
        pin_code: pinCode,
        area: area || null,
        report_category: reportCategory,
        comments: comments || null,
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create nearby request";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-1">Request Nearby Report</h3>
        <p className="text-sm text-gray-500 mb-4">
          Request a report for a property near this listing area.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address *
            </label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="Full property address"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pin Code</label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area (optional)</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., Koramangala"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="VALUATION">Valuation</option>
              <option value="LEGAL">Legal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments (optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
              placeholder="Any additional details for the vendor..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Nearby Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
