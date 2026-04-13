"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { VendorMapResponse } from "@/types/map";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const VendorMapInner = dynamic(() => import("./_components/vendor-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
      <Skeleton className="h-6 w-32" />
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
      <PageHeader title="Coverage Map" description="View your reports and competitor density" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          type="text"
          placeholder="Filter by city"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="w-full sm:w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
          <p className="text-muted-foreground text-sm">Loading map data...</p>
        </div>
      ) : data ? (
        <div className="relative" style={{ height: "calc(100vh - 220px)" }}>
          <Card className="overflow-hidden h-full">
            <VendorMapInner ownReports={data.own_reports} competitorAreas={data.competitor_areas} />
          </Card>
          {/* Legend */}
          <Card className="absolute bottom-4 left-4 z-[1000] px-3 py-2 shadow-md">
            <div className="text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                  You
                </Badge>
                <span className="text-foreground">Your Reports</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
                  Others
                </Badge>
                <span className="text-foreground">Other Vendors</span>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <p className="text-muted-foreground">Failed to load map data.</p>
      )}
    </div>
  );
}
