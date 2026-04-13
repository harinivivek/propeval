"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface PriceBand {
  id: string;
  city: string;
  property_type: string;
  report_category: string;
  min_price: string;
  max_price: string;
}

export default function AdminPriceBandsPage() {
  const [bands, setBands] = useState<PriceBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ city: "", property_type: "RESIDENTIAL", report_category: "VALUATION", min_price: "", max_price: "" });
  const [saving, setSaving] = useState(false);

  const fetchBands = async () => {
    try {
      const data = await api.get<PriceBand[]>("/api/admin/price-bands");
      setBands(data);
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchBands(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/admin/price-bands", form);
      toast.success("Price band saved");
      setShowForm(false);
      setForm({ city: "", property_type: "RESIDENTIAL", report_category: "VALUATION", min_price: "", max_price: "" });
      fetchBands();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/price-bands/${id}`);
      toast.success("Price band deleted");
      fetchBands();
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Price Bands</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Add Price Band"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <input placeholder="Min Price" type="number" value={form.min_price} onChange={(e) => setForm({ ...form, min_price: e.target.value })} className="border rounded-md p-2 text-sm" required />
          <div className="flex gap-2">
            <input placeholder="Max Price" type="number" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} className="border rounded-md p-2 text-sm flex-1" required />
            <button type="submit" disabled={saving} className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50">
              {saving ? "..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : bands.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No price bands configured yet.</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">City</th>
                <th className="text-left p-3 font-medium">Property Type</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-right p-3 font-medium">Min Price</th>
                <th className="text-right p-3 font-medium">Max Price</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">{b.city}</td>
                  <td className="p-3">{b.property_type}</td>
                  <td className="p-3">{b.report_category}</td>
                  <td className="p-3 text-right">INR {parseFloat(b.min_price).toLocaleString()}</td>
                  <td className="p-3 text-right">INR {parseFloat(b.max_price).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
