"use client";

import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const selectClassName = "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <PageHeader title="My Pricing" description="Set your prices for marketplace visibility">
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Cancel" : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add Price
            </>
          )}
        </Button>
      </PageHeader>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="mb-1">City</Label>
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              </div>
              <div>
                <Label className="mb-1">Property Type</Label>
                <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })} className={selectClassName}>
                  <option value="RESIDENTIAL">Residential</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="INDUSTRIAL">Industrial</option>
                  <option value="AGRICULTURAL">Agricultural</option>
                </select>
              </div>
              <div>
                <Label className="mb-1">Category</Label>
                <select value={form.report_category} onChange={(e) => setForm({ ...form, report_category: e.target.value })} className={selectClassName}>
                  <option value="VALUATION">Valuation</option>
                  <option value="LEGAL">Legal</option>
                </select>
              </div>
              <div>
                <Label className="mb-1">Price (INR)</Label>
                <div className="flex gap-2">
                  <Input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                  <Button type="submit" disabled={saving} size="sm" className="shrink-0 h-9">
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? "..." : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No pricing set yet. Add pricing to appear in marketplace search.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead>Property Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Your Price</TableHead>
                <TableHead className="text-right">Band (Min-Max)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const price = parseFloat(item.price);
                const min = item.min_price ? parseFloat(item.min_price) : null;
                const max = item.max_price ? parseFloat(item.max_price) : null;
                const nearFloor = min && price <= min * 1.1;
                const nearCeiling = max && price >= max * 0.9;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.city}</TableCell>
                    <TableCell>{item.property_type}</TableCell>
                    <TableCell>{item.report_category}</TableCell>
                    <TableCell className="text-right">
                      <span className={nearFloor ? "text-amber-600 font-medium" : nearCeiling ? "text-destructive font-medium" : "font-medium"}>
                        INR {price.toLocaleString()}
                      </span>
                      {nearFloor && (
                        <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200 text-xs">near floor</Badge>
                      )}
                      {nearCeiling && (
                        <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200 text-xs">near ceiling</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {min && max ? `INR ${min.toLocaleString()} — ${max.toLocaleString()}` : "No band set"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
