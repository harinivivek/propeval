"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface VendorPricingItem {
  id: string;
  city: string;
  property_type: string;
  report_category: string;
  price: string;
  min_price: string | null;
  max_price: string | null;
}

export default function VendorPricingPage() {
  const [items, setItems] = useState<VendorPricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ city: "", property_type: "RESIDENTIAL", report_category: "VALUATION", price: "" });
  const [saving, setSaving] = useState(false);

  const fetchPricing = async () => {
    try {
      const data = await api.get<VendorPricingItem[]>("/api/vendor/pricing");
      setItems(data);
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchPricing(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/api/vendor/pricing", [form]);
      toast.success("Pricing updated");
      setShowForm(false);
      setForm({ city: "", property_type: "RESIDENTIAL", report_category: "VALUATION", price: "" });
      fetchPricing();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save pricing");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">My Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">Set your prices for marketplace visibility</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Add Price"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="border rounded-md p-2 text-sm" required />
          <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })} className="border rounded-md p-2 text-sm">
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="AGRICULTURAL">Agricultural</option>
          </select>
          <select value={form.report_category} onChange={(e) => setForm({ ...form, report_category: e.target.value })} className="border rounded-md p-2 text-sm">
            <option value="VALUATION">Valuation</option>
            <option value="LEGAL">Legal</option>
          </select>
          <div className="flex gap-2">
            <input placeholder="Price (INR)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border rounded-md p-2 text-sm flex-1" required />
            <button type="submit" disabled={saving} className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50">
              {saving ? "..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No pricing set yet. Add pricing to appear in marketplace search.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">City</th>
                <th className="text-left p-3 font-medium">Property Type</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-right p-3 font-medium">Your Price</th>
                <th className="text-right p-3 font-medium">Band (Min-Max)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const price = parseFloat(item.price);
                const min = item.min_price ? parseFloat(item.min_price) : null;
                const max = item.max_price ? parseFloat(item.max_price) : null;
                const nearFloor = min && price <= min * 1.1;
                const nearCeiling = max && price >= max * 0.9;

                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3">{item.city}</td>
                    <td className="p-3">{item.property_type}</td>
                    <td className="p-3">{item.report_category}</td>
                    <td className={`p-3 text-right font-medium ${nearFloor ? "text-amber-600" : nearCeiling ? "text-red-600" : ""}`}>
                      INR {price.toLocaleString()}
                      {nearFloor && <span className="text-xs ml-1">(near floor)</span>}
                      {nearCeiling && <span className="text-xs ml-1">(near ceiling)</span>}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {min && max ? `INR ${min.toLocaleString()} — ${max.toLocaleString()}` : "No band set"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
