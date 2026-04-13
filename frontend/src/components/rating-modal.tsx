"use client";

import { useState } from "react";
import { RatingStars } from "./rating-stars";
import { api } from "@/lib/api";
import { toast } from "sonner";

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Rate Vendor</h3>
        <p className="text-sm text-muted-foreground mb-4">
          How was your experience with <strong>{vendorName}</strong>?
        </p>

        <div className="flex justify-center mb-6">
          <RatingStars
            rating={rating}
            interactive
            onChange={setRating}
            size="lg"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}
