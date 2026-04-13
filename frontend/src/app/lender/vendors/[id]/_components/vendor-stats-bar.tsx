"use client";

import type { VendorPublicProfile } from "@/types/vendor-profile";

interface VendorStatsBarProps {
  profile: VendorPublicProfile;
}

export function VendorStatsBar({ profile }: VendorStatsBarProps) {
  const stats = [
    { label: "Jobs Completed", value: profile.total_completed_jobs.toString() },
    { label: "Avg Rating", value: profile.avg_rating ? `${profile.avg_rating.toFixed(1)}/5` : "N/A" },
    { label: "First-Accept Rate", value: profile.first_time_acceptance_rate != null ? `${profile.first_time_acceptance_rate.toFixed(0)}%` : "N/A" },
    { label: "Avg Turnaround", value: profile.avg_turnaround_hours != null ? `${profile.avg_turnaround_hours.toFixed(0)}h` : "N/A" },
    { label: "Quality Score", value: `${parseFloat(profile.quality_score).toFixed(0)}/100` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border rounded-lg p-3 text-center">
          <div className="text-lg font-bold">{s.value}</div>
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
