"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ListingBrowseResponse } from "@/types/listing";
import { ListingCard } from "./_components/listing-card";

export default function LenderListingsPage() {
  const [data, setData] = useState<ListingBrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [pinCodeFilter, setPinCodeFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [reportCategoryFilter, setReportCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
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
  }, [page, cityFilter, pinCodeFilter, propertyTypeFilter, reportCategoryFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Listings Marketplace</h1>

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
    </div>
  );
}
