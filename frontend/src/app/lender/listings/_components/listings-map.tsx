"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { ListingMapItem, ListingMapResponse } from "@/types/map";
import { Skeleton } from "@/components/ui/skeleton";

const MapWithMarkers = dynamic(() => import("./listings-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full rounded-lg">
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  ),
});

interface ListingsMapProps {
  cityFilter: string;
  pinCodeFilter: string;
  propertyTypeFilter: string;
  reportCategoryFilter: string;
}

export default function ListingsMap({
  cityFilter,
  pinCodeFilter,
  propertyTypeFilter,
  reportCategoryFilter,
}: ListingsMapProps) {
  const [items, setItems] = useState<ListingMapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cityFilter) params.set("city", cityFilter);
        if (pinCodeFilter) params.set("pin_code", pinCodeFilter);
        if (propertyTypeFilter) params.set("property_type", propertyTypeFilter);
        if (reportCategoryFilter) params.set("report_category", reportCategoryFilter);
        const res = await api.get<ListingMapResponse>(`/api/lender/listings/map?${params}`);
        setItems(res.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, [cityFilter, pinCodeFilter, propertyTypeFilter, reportCategoryFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-lg" style={{ height: "calc(100vh - 220px)" }}>
        <p className="text-muted-foreground text-sm">Loading map data...</p>
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 220px)" }} className="rounded-lg overflow-hidden border border-border">
      <MapWithMarkers items={items} />
    </div>
  );
}
