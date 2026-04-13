"use client";

import Link from "next/link";
import type { MarketplaceResult } from "@/types/marketplace";
import { TierBadge } from "@/components/tier-badge";
import { RatingStars } from "@/components/rating-stars";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

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
    <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-teal-500 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 text-lg">
          &#128196;
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {result.property_type}
            </Badge>
            <span className="text-sm font-semibold text-foreground">{result.locality_name || result.pin_code}</span>
            <span className="text-xs text-muted-foreground">{result.city}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
            <span>{result.report_count} report{result.report_count !== 1 ? "s" : ""}</span>
            {age && <span>{age}</span>}
            {result.vendor_name && (
              <span>
                by{" "}
                <Link href={`/lender/vendors/${result.vendor_id}`} className="text-primary hover:underline">
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
          className={buttonVariants({ size: "sm" })}
        >
          View
        </Link>
      </div>
    </Card>
  );
}

function VendorCard({ result }: { result: Extract<MarketplaceResult, { result_type: "vendor" }> }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-emerald-500 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 text-lg">
          &#128100;
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Link
              href={`/lender/vendors/${result.vendor_id}`}
              className="text-sm font-semibold text-foreground hover:text-primary"
            >
              {result.vendor_name}
            </Link>
            <TierBadge tier={result.vendor_tier as "NEW" | "VERIFIED" | "TOP_VALUER"} size="sm" />
          </div>

          {result.specialization_tags && result.specialization_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {result.specialization_tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
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
          className={buttonVariants({ size: "sm", variant: "default", className: "bg-emerald-600 hover:bg-emerald-700" })}
        >
          View Profile
        </Link>
      </div>
    </Card>
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
