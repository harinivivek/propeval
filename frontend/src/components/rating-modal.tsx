"use client";

import { useState } from "react";
import { RatingStars } from "./rating-stars";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RatingModalProps {
  vendorId: string;
  vendorName: string;
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
  onRated?: () => void;
}

export function RatingModal({
  vendorId,
  vendorName,
  requestId,
  isOpen,
  onClose,
  onRated,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/lender/vendors/${vendorId}/rate`, {
        rating,
        report_request_id: requestId,
      });
      toast.success("Rating submitted successfully");
      onRated?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit rating";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Vendor</DialogTitle>
          <DialogDescription>
            How was your experience with <strong>{vendorName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <RatingStars
            rating={rating}
            interactive
            onChange={setRating}
            size="lg"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
