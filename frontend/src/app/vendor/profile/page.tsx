"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { VendorProfile } from "@/types/vendor-profile";
import { TierBadge } from "@/components/tier-badge";
import { ProfileForm } from "./_components/profile-form";
import { ProfilePhotoUpload } from "./_components/profile-photo-upload";

export default function VendorProfilePage() {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const data = await api.get<VendorProfile>("/api/vendor/profile");
      setProfile(data);
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12 text-muted-foreground">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="text-center py-12 text-red-500">Failed to load profile</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your public profile visible to lenders
          </p>
        </div>
        <TierBadge tier={profile.vendor_tier} size="lg" />
      </div>

      {/* Completeness bar */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Profile Completeness</span>
          <span className="text-sm text-muted-foreground">{profile.profile_completeness}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${profile.profile_completeness}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Photo upload */}
        <div className="lg:col-span-1">
          <ProfilePhotoUpload
            currentPhoto={profile.display_photo}
            onUploaded={fetchProfile}
          />
        </div>

        {/* Profile form */}
        <div className="lg:col-span-2">
          <ProfileForm profile={profile} onSaved={fetchProfile} />
        </div>
      </div>
    </div>
  );
}
