"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ListingDetailResponse, RedactedReportPreview } from "@/types/listing";
import { PurchaseResponse } from "@/types/listing";
import { ReportPreviewCard } from "./_components/report-preview-card";
import { PurchaseDialog } from "./_components/purchase-dialog";
import { UpdateRequestDialog } from "./_components/update-request-dialog";
import { NearbyRequestDialog } from "./_components/nearby-request-dialog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function LenderListingDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ListingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchasingReport, setPurchasingReport] = useState<RedactedReportPreview | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [updateReportId, setUpdateReportId] = useState<string | null>(null);
  const [showNearbyDialog, setShowNearbyDialog] = useState(false);
  const [nearbyRefReportId, setNearbyRefReportId] = useState<string | null>(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<ListingDetailResponse>(`/api/lender/listings/${params.id}`);
      setData(res);
    } catch {
      setError("Failed to load listing");
    } finally {
      setLoading(false);
    }
  };

  const getReportForUpdate = (reportId: string) => {
    return data?.reports.find((r) => r.id === reportId) || null;
  };

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  const handlePurchase = async () => {
    if (!purchasingReport || !data) return;
    setPurchaseLoading(true);
    try {
      await api.post<PurchaseResponse>(
        `/api/lender/listings/${data.listing.id}/reports/${purchasingReport.id}/purchase`,
        {}
      );
      setPurchasingReport(null);
      await fetchDetail();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Purchase failed";
      alert(message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleDownload = async (_reportId: string) => {
    window.location.href = "/lender/listings/purchases";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }
  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Listing not found</p>;

  const { listing, reports } = data;

  return (
    <div>
      <a href="/lender/listings" className="text-sm text-primary hover:underline mb-4 inline-block">
        ← Back to Listings
      </a>

      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{listing.macro_location}</h1>
              <p className="text-muted-foreground mt-1">
                {listing.city} · {listing.pin_code} · <Badge variant="secondary">{listing.property_type}</Badge>
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {listing.report_count} report{listing.report_count !== 1 ? "s" : ""} ·{" "}
                {listing.vendor_count} vendor{listing.vendor_count !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              onClick={() => {
                const firstReport = reports.length > 0 ? reports[0] : null;
                if (firstReport) {
                  setNearbyRefReportId(firstReport.id);
                  setShowNearbyDialog(true);
                }
              }}
              variant="outline"
            >
              Request Nearby Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {reports.map((r) => (
          <ReportPreviewCard
            key={r.id}
            report={r}
            onPurchase={(id) => {
              const report = reports.find((rp) => rp.id === id);
              if (report) setPurchasingReport(report);
            }}
            onDownload={handleDownload}
            onRequestUpdate={(id) => setUpdateReportId(id)}
          />
        ))}
      </div>

      {reports.length === 0 && (
        <p className="text-muted-foreground">No reports available in this listing.</p>
      )}

      {purchasingReport && (
        <PurchaseDialog
          reportCategory={purchasingReport.report_category}
          locality={purchasingReport.locality}
          price={null}
          loading={purchaseLoading}
          onConfirm={handlePurchase}
          onCancel={() => setPurchasingReport(null)}
        />
      )}

      {updateReportId && (() => {
        const rpt = getReportForUpdate(updateReportId);
        return rpt ? (
          <UpdateRequestDialog
            reportId={updateReportId}
            reportCategory={rpt.report_category}
            locality={rpt.locality}
            reportDate={rpt.report_date}
            onSuccess={() => {
              setUpdateReportId(null);
              window.location.href = "/lender/requests";
            }}
            onCancel={() => setUpdateReportId(null)}
          />
        ) : null;
      })()}

      {showNearbyDialog && nearbyRefReportId && (
        <NearbyRequestDialog
          referenceReportId={nearbyRefReportId}
          listingCity={listing.city}
          listingPinCode={listing.pin_code}
          onSuccess={() => {
            setShowNearbyDialog(false);
            window.location.href = "/lender/requests";
          }}
          onCancel={() => setShowNearbyDialog(false)}
        />
      )}
    </div>
  );
}
