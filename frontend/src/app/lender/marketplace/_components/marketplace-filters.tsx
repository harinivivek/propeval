"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MarketplaceFiltersProps {
  city: string;
  setCity: (v: string) => void;
  pinCode: string;
  setPinCode: (v: string) => void;
  propertyType: string;
  setPropertyType: (v: string) => void;
  resultType: string;
  setResultType: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  minRating: string;
  setMinRating: (v: string) => void;
  vendorTier: string;
  setVendorTier: (v: string) => void;
  onSearch: () => void;
}

export function MarketplaceFilters({
  city, setCity,
  pinCode, setPinCode,
  propertyType, setPropertyType,
  resultType, setResultType,
  sortBy, setSortBy,
  minRating, setMinRating,
  vendorTier, setVendorTier,
  onSearch,
}: MarketplaceFiltersProps) {
  const hasFilters = city || pinCode || propertyType || resultType || minRating || vendorTier;

  const clearAll = () => {
    setCity("");
    setPinCode("");
    setPropertyType("");
    setResultType("");
    setMinRating("");
    setVendorTier("");
    setSortBy("relevance");
  };

  return (
    <Card className="shadow-sm mb-6">
      <CardContent className="p-4">
        {/* Result type toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-medium text-foreground mr-1">Show:</span>
          {[
            { value: "", label: "All" },
            { value: "reports", label: "Reports Only" },
            { value: "vendors", label: "Vendors Only" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setResultType(opt.value); onSearch(); }}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                resultType === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            placeholder="Pin Code"
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value)}
          />
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Types</option>
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="AGRICULTURAL">Agricultural</option>
          </select>
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Any Rating</option>
            <option value="3">3+ Stars</option>
            <option value="3.5">3.5+ Stars</option>
            <option value="4">4+ Stars</option>
            <option value="4.5">4.5+ Stars</option>
          </select>
          <select
            value={vendorTier}
            onChange={(e) => setVendorTier(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Any Tier</option>
            <option value="NEW">New</option>
            <option value="VERIFIED">Verified</option>
            <option value="TOP_VALUER">Top Valuer</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="relevance">Relevance</option>
            <option value="rating">Rating</option>
            <option value="recency">Newest</option>
          </select>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <Button onClick={onSearch} size="sm">
            Search
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clearAll(); onSearch(); }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
