"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TierProgress } from "@/types/vendor-profile";

export function QualityScoreCard() {
  const [progress, setProgress] = useState<TierProgress | null>(null);

  useEffect(() => {
    api.get<TierProgress>("/api/vendor/profile/tier").then(setProgress).catch(() => {});
  }, []);

  if (!progress) return null;

  const score = parseFloat(progress.quality_score);

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-blue-600";
    if (s >= 40) return "text-amber-600";
    return "text-red-600";
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
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Quality Score</h3>
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score.toFixed(0)}
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-blue-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
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
    </div>
  );
}
