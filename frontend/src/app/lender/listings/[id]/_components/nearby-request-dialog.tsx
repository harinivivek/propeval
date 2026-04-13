"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  referenceReportId: string;
  listingCity: string;
  listingPinCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NearbyRequestDialog({
  referenceReportId,
  listingCity,
  listingPinCode,
  onSuccess,
  onCancel,
}: Props) {
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState(listingCity);
  const [pinCode, setPinCode] = useState(listingPinCode);
  const [area, setArea] = useState("");
  const [reportCategory, setReportCategory] = useState("VALUATION");
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!propertyAddress.trim()) {
      setError("Property address is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/api/lender/requests/nearby", {
        report_id: referenceReportId,
        property_address: propertyAddress,
        city,
        pin_code: pinCode,
        area: area || null,
        report_category: reportCategory,
        comments: comments || null,
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create nearby request";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Nearby Report</DialogTitle>
          <DialogDescription>
            Request a report for a property near this listing area.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="nearby-address" className="mb-1">Property Address *</Label>
            <Input
              id="nearby-address"
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="Full property address"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nearby-city" className="mb-1">City</Label>
              <Input
                id="nearby-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nearby-pin" className="mb-1">Pin Code</Label>
              <Input
                id="nearby-pin"
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="nearby-area" className="mb-1">Area (optional)</Label>
            <Input
              id="nearby-area"
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., Koramangala"
            />
          </div>

          <div>
            <Label htmlFor="nearby-type" className="mb-1">Report Type</Label>
            <select
              id="nearby-type"
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="VALUATION">Valuation</option>
              <option value="LEGAL">Legal</option>
            </select>
          </div>

          <div>
            <Label htmlFor="nearby-comments" className="mb-1">Comments (optional)</Label>
            <Textarea
              id="nearby-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
              placeholder="Any additional details for the vendor..."
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Price per your lender pricing agreement.
        </p>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            onClick={onCancel}
            disabled={loading}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Nearby Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
