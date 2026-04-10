"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  VendorListingsResponse,
  VendorListingReportItem,
} from "@/types/listing";
import { ListingGroup } from "./_components/listing-group";
import { ListableReports } from "./_components/listable-reports";

export default function VendorListingsPage() {
  const [listings, setListings] = useState<VendorListingsResponse | null>(null);
  const [listable, setListable] = useState<VendorListingReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (cityFilter) params.set("city", cityFilter);
      if (propertyTypeFilter) params.set("property_type", propertyTypeFilter);
      params.set("page", String(page));
      const qs = params.toString();

      const [listingsRes, listableRes] = await Promise.all([
        api.get<VendorListingsResponse>(`/api/vendor/listings/?${qs}`),
        api.get<VendorListingReportItem[]>("/api/vendor/listings/listable-reports"),
      ]);
      setListings(listingsRes);
      setListable(listableRes);
    } catch {
      setError("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, cityFilter, propertyTypeFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Listings</h1>

      <ListableReports reports={listable} onListed={fetchData} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by city"
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-48"
        />
        <select
          value={propertyTypeFilter}
          onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-48"
        >
          <option value="">All Property Types</option>
          <option value="RESIDENTIAL">Residential</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="INDUSTRIAL">Industrial</option>
          <option value="AGRICULTURAL">Agricultural</option>
        </select>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : listings && listings.groups.length > 0 ? (
        <>
          <div className="space-y-3">
            {listings.groups.map((g) => (
              <ListingGroup key={g.listing.id} group={g} onDelisted={fetchData} />
            ))}
          </div>

          {/* Pagination */}
          {listings.total > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {Math.ceil(listings.total / 20)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= listings.total}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No listed reports yet. Publish reports and list them on the marketplace above.</p>
      )}
    </div>
  );
}
