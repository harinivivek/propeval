"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { LenderConfigWithPreferences, VendorPreferenceEntry } from "@/types/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function LenderConfigTab() {
  const [preferences, setPreferences] = useState<VendorPreferenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    api.get<LenderConfigWithPreferences>("/api/lender/settings/config")
      .then((data) => setPreferences(data.vendor_preferences))
      .catch((e) => toast.error(e.message ?? "Failed to load configuration"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(vendorId: string, currentValue: boolean) {
    setTogglingId(vendorId);
    try {
      await api.put(`/api/lender/settings/vendors/${vendorId}/preference`, {
        auto_approve: !currentValue,
      });
      setPreferences((prev) =>
        prev.map((p) =>
          p.vendor_id === vendorId ? { ...p, auto_approve: !currentValue } : p
        )
      );
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to update preference");
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = preferences.filter((p) =>
    p.vendor_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vendor Auto-Approve</CardTitle>
          <CardDescription>
            When enabled, reports from a vendor are auto-approved without manual review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preferences.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No vendor history yet. Vendors will appear here after completing requests.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Search */}
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors..."
                className="w-full sm:w-64"
              />

              {/* Desktop/Tablet: Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Vendor</TableHead>
                      <TableHead className="px-4">Auto-Approve</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="px-4 py-6 text-center text-muted-foreground text-sm">
                          No vendors match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((p) => (
                        <TableRow key={p.vendor_id}>
                          <TableCell className="px-4 py-3 font-medium">{p.vendor_name}</TableCell>
                          <TableCell className="px-4 py-3">
                            <button
                              role="switch"
                              aria-checked={p.auto_approve}
                              disabled={togglingId === p.vendor_id}
                              onClick={() => handleToggle(p.vendor_id, p.auto_approve)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                                p.auto_approve ? "bg-primary" : "bg-muted-foreground/30"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  p.auto_approve ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Card list */}
              <div className="md:hidden space-y-3">
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">No vendors match your search.</p>
                ) : (
                  filtered.map((p) => (
                    <Card key={p.vendor_id}>
                      <CardContent className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-medium">{p.vendor_name}</span>
                        <button
                          role="switch"
                          aria-checked={p.auto_approve}
                          disabled={togglingId === p.vendor_id}
                          onClick={() => handleToggle(p.vendor_id, p.auto_approve)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                            p.auto_approve ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              p.auto_approve ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
