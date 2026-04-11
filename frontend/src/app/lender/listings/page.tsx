"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ListingBrowseResponse } from "@/types/listing";
import { ListingCard } from "./_components/listing-card";
import ListingsMap from "./_components/listings-map";

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Listings Marketplace</h1>

        {/* View toggle */}
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 py-2 text-sm ${viewMode === "map" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            title="Map view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="City"
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-40"
        />
        <input
          type="text"
          placeholder="Pin Code"
          value={pinCodeFilter}
          onChange={(e) => { setPinCodeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-36"
        />
        <select
          value={propertyTypeFilter}
          onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-44"
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
          className="border rounded px-3 py-2 text-sm w-full sm:w-44"
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
          {error && <p className="text-red-600 mb-4">{error}</p>}

          {loading ? (
            <p className="text-gray-500">Loading listings...</p>
          ) : data && data.listings.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>

              {data.total > data.page_size && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 border rounded text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-500">
                    Page {page} of {Math.ceil(data.total / data.page_size)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * data.page_size >= data.total}
                    className="px-3 py-2 border rounded text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500">No listings available matching your filters.</p>
          )}
        </>
      )}
    </div>
  );
}
