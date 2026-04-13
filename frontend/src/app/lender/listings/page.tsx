"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ListingBrowseResponse } from "@/types/listing";
import { ListingCard } from "./_components/listing-card";
import ListingsMap from "./_components/listings-map";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "list" | "map";

export default function LenderListingsPage() {
  const [data, setData] = useState<ListingBrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [pinCodeFilter, setPinCodeFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [reportCategoryFilter, setReportCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    if (viewMode === "map") return;
    const fetchListings = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (cityFilter) params.set("city", cityFilter);
        if (pinCodeFilter) params.set("pin_code", pinCodeFilter);
        if (propertyTypeFilter) params.set("property_type", propertyTypeFilter);
        if (reportCategoryFilter) params.set("report_category", reportCategoryFilter);
        params.set("page", String(page));
        const res = await api.get<ListingBrowseResponse>(`/api/lender/listings/?${params}`);
        setData(res);
      } catch {
        setError("Failed to load listings");
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, [page, cityFilter, pinCodeFilter, propertyTypeFilter, reportCategoryFilter, viewMode]);

  return (
    <div>
      <PageHeader title="Listings Marketplace">
        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          <Button
            onClick={() => setViewMode("list")}
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            className="rounded-none rounded-l-lg"
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </Button>
          <Button
            onClick={() => setViewMode("map")}
            variant={viewMode === "map" ? "default" : "outline"}
            size="sm"
            className="rounded-none rounded-r-lg"
            title="Map view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
        <Input
          type="text"
          placeholder="City"
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="w-full sm:w-40"
        />
        <Input
          type="text"
          placeholder="Pin Code"
          value={pinCodeFilter}
          onChange={(e) => { setPinCodeFilter(e.target.value); setPage(1); }}
          className="w-full sm:w-36"
        />
        <select
          value={propertyTypeFilter}
          onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 w-full sm:w-44"
        >
          <option value="">All Property Types</option>
          <option value="RESIDENTIAL">Residential</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="INDUSTRIAL">Industrial</option>
          <option value="AGRICULTURAL">Agricultural</option>
        </select>
        <select
          value={reportCategoryFilter}
          onChange={(e) => { setReportCategoryFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 w-full sm:w-44"
        >
          <option value="">All Report Types</option>
          <option value="VALUATION">Valuation</option>
          <option value="LEGAL">Legal</option>
        </select>
      </div>

      {/* Map view */}
      {viewMode === "map" && (
        <ListingsMap
          cityFilter={cityFilter}
          pinCodeFilter={pinCodeFilter}
          propertyTypeFilter={propertyTypeFilter}
          reportCategoryFilter={reportCategoryFilter}
        />
      )}

      {/* List view */}
      {viewMode === "list" && (
        <>
          {error && <p className="text-destructive mb-4">{error}</p>}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : data && data.listings.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>

              {data.total > data.page_size && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-2 text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(data.total / data.page_size)}
                  </span>
                  <Button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * data.page_size >= data.total}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No listings available matching your filters.</p>
          )}
        </>
      )}
    </div>
  );
}
