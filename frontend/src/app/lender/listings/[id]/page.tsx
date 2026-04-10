"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ListingDetailResponse, RedactedReportPreview } from "@/types/listing";
import { PurchaseResponse } from "@/types/listing";
import { ReportPreviewCard } from "./_components/report-preview-card";
import { PurchaseDialog } from "./_components/purchase-dialog";

export default function LenderListingDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ListingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchasingReport, setPurchasingReport] = useState<RedactedReportPreview | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

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

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Listing not found</p>;

  const { listing, reports } = data;

  return (
    <div>
      <a href="/lender/listings" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Listings
      </a>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{listing.macro_location}</h1>
        <p className="text-gray-500">
          {listing.city} · {listing.pin_code} · {listing.property_type}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {listing.report_count} report{listing.report_count !== 1 ? "s" : ""} ·{" "}
          {listing.vendor_count} vendor{listing.vendor_count !== 1 ? "s" : ""}
        </p>
      </div>

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
          />
        ))}
      </div>

      {reports.length === 0 && (
        <p className="text-gray-500">No reports available in this listing.</p>
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
    </div>
  );
}
