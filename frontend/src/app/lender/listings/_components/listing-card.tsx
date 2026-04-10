import { ListingResponse } from "@/types/listing";

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

const PROPERTY_COLORS: Record<string, string> = {
  RESIDENTIAL: "bg-green-100 text-green-800",
  COMMERCIAL: "bg-blue-100 text-blue-800",
  INDUSTRIAL: "bg-orange-100 text-orange-800",
  AGRICULTURAL: "bg-yellow-100 text-yellow-800",
};

export function ListingCard({ listing }: Props) {
  const colorClass = PROPERTY_COLORS[listing.property_type] || "bg-gray-100 text-gray-800";

  return (
    <a
      href={`/lender/listings/${listing.id}`}
      className="block border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{listing.macro_location}</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${colorClass}`}>
          {listing.property_type}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {listing.city} · {listing.pin_code}
      </p>
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4 text-gray-600">
          <span>{listing.report_count} report{listing.report_count !== 1 ? "s" : ""}</span>
          <span>{listing.vendor_count} vendor{listing.vendor_count !== 1 ? "s" : ""}</span>
        </div>
        <span className="text-gray-400 text-xs">
          {formatAge(listing.latest_report_date)}
        </span>
      </div>
    </a>
  );
}
