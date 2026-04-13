"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MarketplaceSearchResponse, MarketplaceResult } from "@/types/marketplace";
import { MarketplaceFilters } from "./_components/marketplace-filters";
import { MarketplaceMap } from "./_components/marketplace-map";
import { ResultCard } from "./_components/result-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketplacePage() {
  const [results, setResults] = useState<MarketplaceResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("split");

  // Filters
  const [city, setCity] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [resultType, setResultType] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [minRating, setMinRating] = useState("");
  const [vendorTier, setVendorTier] = useState("");

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (city) params.set("city", city);
      if (pinCode) params.set("pin_code", pinCode);
      if (propertyType) params.set("property_type", propertyType);
      if (resultType) params.set("result_type", resultType);
      if (sortBy) params.set("sort_by", sortBy);
      if (minRating) params.set("min_rating", minRating);
      if (vendorTier) params.set("vendor_tier", vendorTier);
      params.set("page", page.toString());
      params.set("page_size", "20");

      const data = await api.get<MarketplaceSearchResponse>(
        `/api/marketplace/search?${params.toString()}`
      );
      setResults(data.results);
      setTotal(data.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [city, pinCode, propertyType, resultType, sortBy, minRating, vendorTier, page]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <PageHeader title="Marketplace" description="Browse reports and vendors">
        {/* View toggle - desktop: split/list/map, mobile: list/map toggle */}
        <div className="hidden lg:flex rounded-md overflow-hidden">
          <Button
            variant={viewMode === "split" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("split")}
            className="rounded-r-none"
          >
            Split
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-none border-x-0"
          >
            List
          </Button>
          <Button
            variant={viewMode === "map" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("map")}
            className="rounded-l-none"
          >
            Map
          </Button>
        </div>
        <div className="lg:hidden flex rounded-md overflow-hidden">
          <Button
            variant={viewMode !== "map" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-r-none"
          >
            List
          </Button>
          <Button
            variant={viewMode === "map" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("map")}
            className="rounded-l-none"
          >
            Map
          </Button>
        </div>
      </PageHeader>

      <MarketplaceFilters
        city={city}
        setCity={setCity}
        pinCode={pinCode}
        setPinCode={setPinCode}
        propertyType={propertyType}
        setPropertyType={setPropertyType}
        resultType={resultType}
        setResultType={setResultType}
        sortBy={sortBy}
        setSortBy={setSortBy}
        minRating={minRating}
        setMinRating={setMinRating}
        vendorTier={vendorTier}
        setVendorTier={setVendorTier}
        onSearch={() => { setPage(1); fetchResults(); }}
      />

      {/* Split view (desktop) */}
      {viewMode === "split" && (
        <div className="hidden lg:grid lg:grid-cols-2 gap-4" style={{ height: "calc(100vh - 280px)" }}>
          <div className="rounded-lg overflow-hidden border border-border">
            <MarketplaceMap results={results} />
          </div>
          <div className="overflow-y-auto space-y-3 pr-2">
            {loading && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No results found. Try adjusting your filters.
              </div>
            )}
            {!loading && results.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* List view */}
      {(viewMode === "list" || (viewMode === "split" && true)) && (
        <div className={viewMode === "split" ? "lg:hidden" : ""}>
          <div className="space-y-3">
            {loading && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No results found. Try adjusting your filters.
              </div>
            )}
            {!loading && results.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* Map-only view */}
      {viewMode === "map" && (
        <div className="rounded-lg overflow-hidden border border-border" style={{ height: "calc(100vh - 280px)" }}>
          <MarketplaceMap results={results} />
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} results)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
