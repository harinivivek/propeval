"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TierBadge } from "@/components/tier-badge";
import type { TierProgress } from "@/types/vendor-profile";

export function TierCard() {
  const [progress, setProgress] = useState<TierProgress | null>(null);

  useEffect(() => {
    api.get<TierProgress>("/api/vendor/profile/tier").then(setProgress).catch(() => {});
  }, []);

  if (!progress) return null;

  const req = progress.next_tier_requirements;
  const jobsPct = req
    ? Math.min(100, ((req.current_completed_jobs || 0) / (req.min_completed_jobs || 1)) * 100)
    : 100;
  const scorePct = req
    ? Math.min(100, (parseFloat(req.current_quality_score || "0") / (req.min_quality_score || 1)) * 100)
    : 100;

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Your Tier</h3>
        <TierBadge tier={progress.current_tier} />
      </div>

      {progress.next_tier && req && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Progress to <strong>{progress.next_tier.replace("_", " ")}</strong>
          </p>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Completed Jobs</span>
              <span>{req.current_completed_jobs || 0} / {req.min_completed_jobs}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${jobsPct}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Quality Score</span>
              <span>{parseFloat(req.current_quality_score || "0").toFixed(0)} / {req.min_quality_score}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${scorePct}%` }} />
            </div>
          </div>
        </div>
      )}

      {!progress.next_tier && (
        <p className="text-xs text-green-600 font-medium">You&apos;ve reached the highest tier!</p>
      )}
    </div>
  );
}
