"use client";

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
    <div className="bg-white border rounded-lg p-4">
      {/* Result type toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm font-medium mr-1">Show:</span>
        {[
          { value: "", label: "All" },
          { value: "reports", label: "Reports Only" },
          { value: "vendors", label: "Vendors Only" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setResultType(opt.value); onSearch(); }}
            className={`px-3 py-1 text-sm rounded-full border ${
              resultType === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border rounded-md p-2 text-sm"
        />
        <input
          placeholder="Pin Code"
          value={pinCode}
          onChange={(e) => setPinCode(e.target.value)}
          className="border rounded-md p-2 text-sm"
        />
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          className="border rounded-md p-2 text-sm"
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
          className="border rounded-md p-2 text-sm"
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
          className="border rounded-md p-2 text-sm"
        >
          <option value="">Any Tier</option>
          <option value="NEW">New</option>
          <option value="VERIFIED">Verified</option>
          <option value="TOP_VALUER">Top Valuer</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border rounded-md p-2 text-sm"
        >
          <option value="relevance">Relevance</option>
          <option value="rating">Rating</option>
          <option value="recency">Newest</option>
        </select>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={onSearch}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Search
        </button>
        {hasFilters && (
          <button
            onClick={() => { clearAll(); onSearch(); }}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
