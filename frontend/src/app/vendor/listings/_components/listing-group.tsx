"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { VendorListingGroup } from "@/types/listing";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  group: VendorListingGroup;
  onDelisted: () => void;
}

export function ListingGroup({ group, onDelisted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { listing, reports } = group;

  const handleDelist = async (reportId: string) => {
    try {
      await api.post(`/api/vendor/listings/reports/${reportId}/delist`, {});
      onDelisted();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delist report";
      alert(message);
    }
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-muted hover:bg-muted/80 text-left transition-colors"
      >
        <div>
          <span className="font-medium text-foreground">{listing.macro_location}</span>
          <span className="text-muted-foreground text-sm ml-2">
            {listing.city} · {listing.pin_code} · {listing.property_type}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-border">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4"
            >
              <div className="text-sm">
                <span className="font-medium text-foreground">{r.property_address || "No address"}</span>
                <div className="text-muted-foreground mt-0.5">
                  {r.report_category} · {r.property_type}
                  {r.report_date && ` · ${r.report_date}`}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelist(r.id)}
                className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Delist
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
