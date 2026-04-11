"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { VendorMapResponse } from "@/types/map";

const VendorMapInner = dynamic(() => import("./_components/vendor-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
      <p className="text-gray-400 text-sm">Loading map…</p>
    </div>
  ),
});

export default function VendorMapPage() {
  const [data, setData] = useState<VendorMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cityFilter) params.set("city", cityFilter);
        const res = await api.get<VendorMapResponse>(`/api/vendor/map/?${params}`);
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [cityFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Coverage Map</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by city"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full sm:w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
          <p className="text-gray-400 text-sm">Loading map data…</p>
        </div>
      ) : data ? (
        <div className="relative" style={{ height: "calc(100vh - 220px)" }}>
          <div className="rounded-lg overflow-hidden border border-gray-200 h-full">
            <VendorMapInner ownReports={data.own_reports} competitorAreas={data.competitor_areas} />
          </div>
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 z-[1000] text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              Your Reports
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Other Vendors
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Failed to load map data.</p>
      )}
    </div>
  );
}
