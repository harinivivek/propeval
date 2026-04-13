"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Your Tier</CardTitle>
        <TierBadge tier={progress.current_tier} />
      </CardHeader>
      <CardContent>
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
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${jobsPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Quality Score</span>
                <span>{parseFloat(req.current_quality_score || "0").toFixed(0)} / {req.min_quality_score}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${scorePct}%` }} />
              </div>
            </div>
          </div>
        )}

        {!progress.next_tier && (
          <p className="text-xs text-emerald-600 font-medium">You&apos;ve reached the highest tier!</p>
        )}
      </CardContent>
    </Card>
  );
}
