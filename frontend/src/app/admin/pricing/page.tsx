"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Lender } from "@/types/user";
import type { PricingRule, PricingRuleCreate } from "@/types/pricing";

const REPORT_CATEGORIES = ["VALUATION", "LEGAL"];
const PROPERTY_TYPES = ["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "AGRICULTURAL"];

function emptyForm(lenderId: string): PricingRuleCreate {
  return {
    lender_id: lenderId,
    report_category: "VALUATION",
    city: "",
    area: null,
    property_type: "RESIDENTIAL",
    new_request_price: "",
    listing_download_price: "",
    update_additional_price: "",
    nearby_additional_price: "",
  };
}

export default function AdminPricingPage() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [selectedLender, setSelectedLender] = useState<string>("");
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingRuleCreate>(emptyForm(""));
  const [saving, setSaving] = useState(false);

  const [filterCity, setFilterCity] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPropertyType, setFilterPropertyType] = useState("");

  useEffect(() => {
    api.get<Lender[]>("/api/admin/lenders").then(setLenders).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedLender) {
      setRules([]);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ lender_id: selectedLender });
    if (filterCity) params.set("city", filterCity);
    if (filterCategory) params.set("report_category", filterCategory);
    if (filterPropertyType) params.set("property_type", filterPropertyType);
    api
      .get<PricingRule[]>(`/api/admin/pricing/rules?${params}`)
      .then(setRules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedLender, filterCity, filterCategory, filterPropertyType]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm(selectedLender));
    setShowForm(true);
  }

  function openEdit(rule: PricingRule) {
    setEditingId(rule.id);
    setForm({
      lender_id: rule.lender_id,
      report_category: rule.report_category,
      city: rule.city,
      area: rule.area,
      property_type: rule.property_type,
      new_request_price: rule.new_request_price,
      listing_download_price: rule.listing_download_price,
      update_additional_price: rule.update_additional_price,
      nearby_additional_price: rule.nearby_additional_price,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, area: form.area || null };
      if (editingId) {
        const updated = await api.put<PricingRule>(
          `/api/admin/pricing/rules/${editingId}`,
          payload
        );
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await api.post<PricingRule>(
          "/api/admin/pricing/rules",
          payload
        );
        setRules((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    if (!confirm("Delete this pricing rule?")) return;
    try {
      await api.delete(`/api/admin/pricing/rules/${ruleId}`);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Pricing Rules</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure pricing per lender, city, property type, and report category
        </p>
      </div>

      {/* Lender selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedLender}
          onChange={(e) => setSelectedLender(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a lender</option>
          {lenders.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {selectedLender && (
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            Add Rule
          </button>
        )}
      </div>

      {/* Filters */}
      {selectedLender && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            placeholder="Filter by city"
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterPropertyType}
            onChange={(e) => setFilterPropertyType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Property Types</option>
            {PROPERTY_TYPES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-700">
            {editingId ? "Edit Pricing Rule" : "New Pricing Rule"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
              <input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mumbai"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Area</label>
              <input
                value={form.area || ""}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank for city-wide pricing"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Property Type *</label>
              <select
                required
                value={form.property_type}
                onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PROPERTY_TYPES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Report Category *</label>
              <select
                required
                value={form.report_category}
                onChange={(e) => setForm({ ...form, report_category: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New Request Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.new_request_price}
                onChange={(e) => setForm({ ...form, new_request_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Download Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.listing_download_price}
                onChange={(e) => setForm({ ...form, listing_download_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Update Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.update_additional_price}
                onChange={(e) => setForm({ ...form, update_additional_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nearby Price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.nearby_additional_price}
                onChange={(e) => setForm({ ...form, nearby_additional_price: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Update Rule" : "Save Rule"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Desktop/Tablet: Table */}
      {selectedLender && (
        <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">City</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Area</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">New</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Download</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Update</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Nearby</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td>
                  </tr>
                )}
                {!loading && rules.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      No pricing rules. Add one above.
                    </td>
                  </tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{r.city}</td>
                    <td className="px-4 py-3 text-gray-600">{r.area || "All"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.property_type}</td>
                    <td className="px-4 py-3 text-gray-600">{r.report_category}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.new_request_price}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.listing_download_price}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.update_additional_price}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{r.nearby_additional_price}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile: Card list */}
      {selectedLender && (
        <div className="md:hidden space-y-3">
          {loading && <p className="text-center text-gray-400 py-8">Loading...</p>}
          {!loading && rules.length === 0 && (
            <p className="text-center text-gray-400 py-8">No pricing rules. Add one above.</p>
          )}
          {rules.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{r.city} {r.area ? `/ ${r.area}` : ""}</div>
                  <div className="text-sm text-gray-500">{r.property_type} - {r.report_category}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(r)} className="text-blue-600 text-sm hover:underline">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 text-sm hover:underline">Delete</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">New:</span> <span className="font-medium">{r.new_request_price}</span></div>
                <div><span className="text-gray-500">Download:</span> <span className="font-medium">{r.listing_download_price}</span></div>
                <div><span className="text-gray-500">Update:</span> <span className="font-medium">{r.update_additional_price}</span></div>
                <div><span className="text-gray-500">Nearby:</span> <span className="font-medium">{r.nearby_additional_price}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
