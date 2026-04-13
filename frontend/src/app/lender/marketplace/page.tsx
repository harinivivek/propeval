"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MarketplaceSearchResponse, MarketplaceResult } from "@/types/marketplace";
import { MarketplaceFilters } from "./_components/marketplace-filters";
import { MarketplaceMap } from "./_components/marketplace-map";
import { ResultCard } from "./_components/result-card";

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <div className="flex items-center gap-2">
          {/* View toggle - desktop: split, mobile: list/map toggle */}
          <div className="hidden lg:flex border rounded-md overflow-hidden text-sm">
            <button
              onClick={() => setViewMode("split")}
              className={`px-3 py-1.5 ${viewMode === "split" ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 border-l ${viewMode === "list" ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-1.5 border-l ${viewMode === "map" ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}
            >
              Map
            </button>
          </div>
          <div className="lg:hidden flex border rounded-md overflow-hidden text-sm">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 ${viewMode !== "map" ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-1.5 border-l ${viewMode === "map" ? "bg-blue-600 text-white" : "hover:bg-gray-50"}`}
            >
              Map
            </button>
          </div>
        </div>
      </div>

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
          <div className="rounded-lg overflow-hidden border">
            <MarketplaceMap results={results} />
          </div>
          <div className="overflow-y-auto space-y-3 pr-2">
            {loading && <div className="text-center py-8 text-muted-foreground">Searching...</div>}
            {!loading && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No results found. Try adjusting your filters.
              </div>
            )}
            {results.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* List view */}
      {(viewMode === "list" || (viewMode === "split" && true)) && (
        <div className={viewMode === "split" ? "lg:hidden" : ""}>
          <div className="space-y-3">
            {loading && <div className="text-center py-8 text-muted-foreground">Searching...</div>}
            {!loading && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No results found. Try adjusting your filters.
              </div>
            )}
            {results.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* Map-only view */}
      {viewMode === "map" && (
        <div className="rounded-lg overflow-hidden border" style={{ height: "calc(100vh - 280px)" }}>
          <MarketplaceMap results={results} />
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} results)
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
