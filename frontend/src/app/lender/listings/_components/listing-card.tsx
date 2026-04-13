import { ListingResponse } from "@/types/listing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  listing: ListingResponse;
}

function formatAge(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

const PROPERTY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  RESIDENTIAL: "default",
  COMMERCIAL: "secondary",
  INDUSTRIAL: "outline",
  AGRICULTURAL: "outline",
};

export function ListingCard({ listing }: Props) {
  const variant = PROPERTY_VARIANTS[listing.property_type] || "outline";

  return (
    <a href={`/lender/listings/${listing.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent>
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-foreground">{listing.macro_location}</h3>
            <Badge variant={variant}>
              {listing.property_type}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {listing.city} · {listing.pin_code}
          </p>
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-4 text-muted-foreground">
              <span>{listing.report_count} report{listing.report_count !== 1 ? "s" : ""}</span>
              <span>{listing.vendor_count} vendor{listing.vendor_count !== 1 ? "s" : ""}</span>
            </div>
            <span className="text-muted-foreground/60 text-xs">
              {formatAge(listing.latest_report_date)}
            </span>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
