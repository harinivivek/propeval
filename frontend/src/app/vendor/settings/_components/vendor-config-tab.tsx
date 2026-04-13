"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { VendorConfigWithExclusions } from "@/types/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface LenderOption {
  id: string;
  name: string;
}

export function VendorConfigTab() {
  const [data, setData] = useState<VendorConfigWithExclusions | null>(null);
  const [lenders, setLenders] = useState<LenderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local form state
  const [autoListing, setAutoListing] = useState(false);
  const [priceThreshold, setPriceThreshold] = useState("");
  const [separateValLegal, setSeparateValLegal] = useState(false);
  const [selectedLenderId, setSelectedLenderId] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<VendorConfigWithExclusions>("/api/vendor/settings/config"),
      api.get<LenderOption[]>("/api/vendor/settings/lenders"),
    ])
      .then(([configData, lenderData]) => {
        setData(configData);
        setAutoListing(configData.config.auto_listing_enabled);
        setPriceThreshold(configData.config.price_threshold ?? "");
        setSeparateValLegal(configData.config.separate_valuation_legal);
        setLenders(lenderData);
      })
      .catch((e) => toast.error(e.message ?? "Failed to load configuration"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put<VendorConfigWithExclusions>(
        "/api/vendor/settings/config",
        {
          auto_listing_enabled: autoListing,
          price_threshold: priceThreshold === "" ? null : priceThreshold,
          separate_valuation_legal: separateValLegal,
        }
      );
      setData(updated);
      toast.success("Configuration saved");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddExclusion() {
    if (!selectedLenderId) return;
    try {
      const updated = await api.post<VendorConfigWithExclusions>(
        "/api/vendor/settings/exclusions",
        { lender_id: selectedLenderId }
      );
      setData(updated);
      setSelectedLenderId("");
      toast.success("Lender excluded");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to add exclusion");
    }
  }

  async function handleRemoveExclusion(lenderId: string) {
    try {
      const updated = await api.delete<VendorConfigWithExclusions>(
        `/api/vendor/settings/exclusions/${lenderId}`
      );
      setData(updated);
      toast.success("Exclusion removed");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to remove exclusion");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-48" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const excludedIds = new Set(data?.exclusions.map((e) => e.lender_id) ?? []);
  const availableLenders = lenders.filter((l) => !excludedIds.has(l.id));

  return (
    <div className="space-y-6">
      {/* Listing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listing Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoListing}
              onChange={(e) => setAutoListing(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">
              Automatically list accepted reports on the marketplace
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="price-threshold">
              Minimum price threshold (&#8377;)
            </Label>
            <Input
              id="price-threshold"
              type="number"
              min="0"
              value={priceThreshold}
              onChange={(e) => setPriceThreshold(e.target.value)}
              placeholder="e.g. 500"
              className="w-full sm:w-48"
            />
            <p className="text-xs text-muted-foreground">Leave blank to accept all prices</p>
          </div>
        </CardContent>
      </Card>

      {/* Report Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Types</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={separateValLegal}
              onChange={(e) => setSeparateValLegal(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
            <div>
              <span className="text-sm text-foreground font-medium">
                Separate valuation &amp; legal settings
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Apply different pricing thresholds and listing preferences for valuation and legal reports
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Save button */}
      <div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      {/* Lender Exclusions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lender Exclusions</CardTitle>
          <CardDescription>
            Excluded lenders will not receive your broadcast requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add exclusion */}
          <div className="flex gap-2">
            <select
              value={selectedLenderId}
              onChange={(e) => setSelectedLenderId(e.target.value)}
              className="flex-1 sm:flex-none sm:w-64 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select a lender to exclude...</option>
              {availableLenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={handleAddExclusion}
              disabled={!selectedLenderId}
            >
              Add
            </Button>
          </div>

          {/* Exclusion list */}
          {data?.exclusions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lenders excluded.</p>
          ) : (
            <ul className="space-y-2">
              {data?.exclusions.map((ex) => (
                <li
                  key={ex.lender_id}
                  className="flex items-center justify-between py-2 px-3 bg-muted rounded-md"
                >
                  <span className="text-sm text-foreground">{ex.lender_name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveExclusion(ex.lender_id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-auto py-1 px-2 text-xs"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
