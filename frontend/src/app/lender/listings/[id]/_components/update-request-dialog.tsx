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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CHECKLIST_ITEMS: Record<string, string> = {
  RECHECK_VALUATION: "Recheck valuation amount",
  VERIFY_BOUNDARIES: "Verify property boundaries",
  UPDATE_PHOTOS: "Update property photos",
  VERIFY_OCCUPANCY: "Verify current occupancy",
  UPDATE_CONSTRUCTION: "Update construction status",
  VERIFY_LEGAL_STATUS: "Verify legal/title status",
  OTHER: "Other (see comments)",
};

interface Props {
  reportId: string;
  reportCategory: string;
  locality: string | null;
  reportDate: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UpdateRequestDialog({
  reportId,
  reportCategory,
  locality,
  reportDate,
  onSuccess,
  onCancel,
}: Props) {
  const [checklist, setChecklist] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleItem = (key: string) => {
    setChecklist((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    if (checklist.length === 0) {
      setError("Please select at least one update item");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/api/lender/requests/update", {
        report_id: reportId,
        checklist,
        comments: comments || null,
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create update request";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Report Update</DialogTitle>
          <DialogDescription>
            {reportCategory} report{locality ? ` · ${locality}` : ""}
            {reportDate ? ` · ${reportDate}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2">What needs updating?</Label>
            <div className="space-y-2">
              {Object.entries(CHECKLIST_ITEMS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist.includes(key)}
                    onChange={() => toggleItem(key)}
                    className="rounded border-input"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="update-comments" className="mb-1">Additional comments</Label>
            <Textarea
              id="update-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Any specific instructions for the vendor..."
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Price per your lender pricing agreement.
          </p>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

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
            {loading ? "Submitting..." : "Submit Update Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
