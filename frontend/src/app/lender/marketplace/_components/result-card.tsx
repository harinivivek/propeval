"use client";

import Link from "next/link";
import type { MarketplaceResult } from "@/types/marketplace";
import { TierBadge } from "@/components/tier-badge";
import { RatingStars } from "@/components/rating-stars";

interface ResultCardProps {
  result: MarketplaceResult;
}

export function ResultCard({ result }: ResultCardProps) {
  if (result.result_type === "report") {
    return <ReportCard result={result} />;
  }
  return <VendorCard result={result} />;
}

function ReportCard({ result }: { result: Extract<MarketplaceResult, { result_type: "report" }> }) {
  const age = result.latest_report_date
    ? getAge(result.latest_report_date)
    : null;

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-lg">
          &#128196;
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {result.property_type}
            </span>
            <span className="text-sm font-semibold">{result.locality_name || result.pin_code}</span>
            <span className="text-xs text-muted-foreground">{result.city}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
            <span>{result.report_count} report{result.report_count !== 1 ? "s" : ""}</span>
            {age && <span>{age}</span>}
            {result.vendor_name && (
              <span>
                by{" "}
                <Link href={`/lender/vendors/${result.vendor_id}`} className="text-blue-600 hover:underline">
                  {result.vendor_name}
                </Link>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {result.vendor_tier && (
              <TierBadge tier={result.vendor_tier as "NEW" | "VERIFIED" | "TOP_VALUER"} size="sm" />
            )}
            {result.avg_rating != null && (
              <RatingStars rating={result.avg_rating} size="sm" showValue count={result.total_ratings} />
            )}
          </div>
        </div>

        <Link
          href={`/lender/listings/${result.listing_id}`}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 flex-shrink-0"
        >
          View
        </Link>
      </div>
    </div>
  );
}

function VendorCard({ result }: { result: Extract<MarketplaceResult, { result_type: "vendor" }> }) {
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-lg">
          &#128100;
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Link
              href={`/lender/vendors/${result.vendor_id}`}
              className="text-sm font-semibold hover:text-blue-600"
            >
              {result.vendor_name}
            </Link>
            <TierBadge tier={result.vendor_tier as "NEW" | "VERIFIED" | "TOP_VALUER"} size="sm" />
          </div>

          {result.specialization_tags && result.specialization_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {result.specialization_tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <RatingStars rating={result.avg_rating} size="sm" showValue count={result.total_ratings} />
            <span>{result.total_completed_jobs} jobs</span>
            {result.service_areas.length > 0 && (
              <span>Covers: {result.service_areas.slice(0, 3).join(", ")}</span>
            )}
          </div>
        </div>

        <Link
          href={`/lender/vendors/${result.vendor_id}`}
          className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 flex-shrink-0"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}

function getAge(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
