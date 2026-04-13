"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TierProgress } from "@/types/vendor-profile";

export function QualityScoreCard() {
  const [progress, setProgress] = useState<TierProgress | null>(null);

  useEffect(() => {
    api.get<TierProgress>("/api/vendor/profile/tier").then(setProgress).catch(() => {});
  }, []);

  if (!progress) return null;

  const score = parseFloat(progress.quality_score);

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-600";
    if (s >= 60) return "text-primary";
    if (s >= 40) return "text-amber-600";
    return "text-destructive";
  };

  const metrics = [
    {
      label: "Avg Rating",
      value: progress.avg_rating ? `${progress.avg_rating.toFixed(1)}/5` : "N/A",
      weight: "30%",
    },
    {
      label: "First-Time Acceptance",
      value: progress.first_time_acceptance_rate != null ? `${progress.first_time_acceptance_rate.toFixed(0)}%` : "N/A",
      weight: "25%",
    },
    {
      label: "On-Time Delivery",
      value: progress.on_time_delivery_rate != null ? `${progress.on_time_delivery_rate.toFixed(0)}%` : "N/A",
      weight: "20%",
    },
    {
      label: "Response Time",
      value: progress.avg_response_hours != null ? `${progress.avg_response_hours.toFixed(0)}h` : "N/A",
      weight: "15%",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Quality Score</CardTitle>
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score.toFixed(0)}
        </span>
      </CardHeader>
      <CardContent>
        <div className="w-full bg-muted rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-primary" : score >= 40 ? "bg-amber-500" : "bg-destructive"}`}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>

        <div className="space-y-2">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{m.label} ({m.weight})</span>
              <span className="font-medium">{m.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
