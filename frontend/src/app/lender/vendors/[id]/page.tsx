"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { VendorPublicProfile, PortfolioResponse } from "@/types/vendor-profile";
import { TierBadge } from "@/components/tier-badge";
import { RatingStars } from "@/components/rating-stars";
import { VendorPortfolio } from "./_components/vendor-portfolio";
import { VendorStatsBar } from "./_components/vendor-stats-bar";

export default function VendorPublicProfilePage() {
  const params = useParams();
  const vendorId = params.id as string;
  const [profile, setProfile] = useState<VendorPublicProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) return;

    Promise.all([
      api.get<VendorPublicProfile>(`/api/lender/vendors/${vendorId}/profile`),
      api.get<PortfolioResponse>(`/api/lender/vendors/${vendorId}/portfolio?page=1&page_size=10`),
    ])
      .then(([p, port]) => {
        setProfile(p);
        setPortfolio(port);
      })
      .catch(() => toast.error("Failed to load vendor profile"))
      .finally(() => setLoading(false));
  }, [vendorId]);

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground">Loading vendor profile...</div>;
  }

  if (!profile) {
    return <div className="text-center py-12 text-red-500">Vendor profile not found</div>;
  }

  const photoUrl = profile.display_photo
    ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}${profile.display_photo}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-300 flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={profile.vendor_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl">
                {profile.vendor_name.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-xl font-bold">{profile.vendor_name}</h1>
              <TierBadge tier={profile.vendor_tier} />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
              <RatingStars rating={profile.avg_rating} size="sm" showValue count={profile.total_ratings} />
              <span>{profile.total_completed_jobs} jobs completed</span>
              {profile.founding_year && <span>Est. {profile.founding_year}</span>}
            </div>

            {profile.specialization_tags && profile.specialization_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {profile.specialization_tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {profile.bio && <p className="text-sm text-gray-600">{profile.bio}</p>}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <VendorStatsBar profile={profile} />

      {/* Service Areas */}
      {profile.service_areas.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Service Areas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {profile.service_areas.map((area, i) => (
              <div key={i} className="border rounded-md p-3">
                <div className="text-sm font-medium">{area.city}</div>
                <div className="text-xs text-muted-foreground">
                  {area.service_type} {area.areas ? `- ${area.areas.join(", ")}` : "- City-wide"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {profile.certifications && Object.keys(profile.certifications).length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Certifications</h2>
          <div className="space-y-2">
            {Object.entries(profile.certifications).map(([key, value]) => (
              value && (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className="text-green-600">&#10003;</span>
                  <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>
                  <span className="text-muted-foreground">{String(value)}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {portfolio && <VendorPortfolio portfolio={portfolio} vendorId={vendorId} />}
    </div>
  );
}
