"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Report } from "@/types/report";

type Props = {
  report: Report;
  onSaved: () => void;
};

/**
 * Sets `reports.latitude` / `reports.longitude` (and merges into extraction JSON)
 * so the vendor coverage map can show a pin. Use when OCR did not extract coordinates.
 */
export function MapCoordinatesForm({ report, onSaved }: Props) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLat(report.latitude != null ? String(report.latitude) : "");
    setLng(report.longitude != null ? String(report.longitude) : "");
  }, [report.id, report.latitude, report.longitude]);

  const handleSave = async () => {
    setError("");
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError("Enter valid numbers for latitude and longitude.");
      return;
    }
    setSaving(true);
    try {
      await api.patch<Report>(`/api/vendor/reports/${report.id}/map-coordinates`, {
        latitude,
        longitude,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
      <div>
        <h3 className="font-semibold text-slate-900">Coverage map position</h3>
        <p className="text-xs text-slate-600 mt-1">
          Decimal degrees (WGS84), e.g. Mumbai area: latitude <code className="text-xs bg-white px-1 rounded">19.05</code>,{" "}
          longitude <code className="text-xs bg-white px-1 rounded">72.91</code>. Required for your pin on the vendor map
          if OCR did not capture coordinates.
        </p>
      </div>
      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-slate-700 block mb-1">Latitude</label>
          <input
            type="text"
            inputMode="decimal"
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="e.g. 19.0544"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-slate-700 block mb-1">Longitude</label>
          <input
            type="text"
            inputMode="decimal"
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="e.g. 72.9136"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save map coordinates"}
      </button>
    </div>
  );
}
