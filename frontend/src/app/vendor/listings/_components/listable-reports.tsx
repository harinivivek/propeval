"use client";

import { Store } from "lucide-react";
import { VendorListingReportItem } from "@/types/listing";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  reports: VendorListingReportItem[];
  onListed: () => void;
}

export function ListableReports({ reports, onListed }: Props) {
  const handleList = async (reportId: string) => {
    try {
      await api.post(`/api/vendor/listings/reports/${reportId}/list`, {});
      onListed();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to list report";
      alert(message);
    }
  };

  if (reports.length === 0) return null;

  return (
    <Card className="mb-8 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-primary">
          {reports.length} unlisted published report{reports.length !== 1 ? "s" : ""} available
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md bg-background p-3 border border-border"
          >
            <div className="text-sm">
              <span className="font-medium text-foreground">{r.property_address || "No address"}</span>
              <span className="text-muted-foreground ml-2">
                {r.city} · {r.pin_code} · {r.report_category} · {r.property_type}
              </span>
              {r.report_date && (
                <span className="text-muted-foreground/60 ml-2">{r.report_date}</span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleList(r.id)}
              className="shrink-0"
            >
              <Store className="h-4 w-4 mr-1" />
              List on Marketplace
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
