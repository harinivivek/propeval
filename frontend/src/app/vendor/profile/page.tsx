"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { VendorProfile } from "@/types/vendor-profile";
import { TierBadge } from "@/components/tier-badge";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-destructive">Failed to load profile</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your public profile visible to lenders">
        <TierBadge tier={profile.vendor_tier} size="lg" />
      </PageHeader>

      {/* Completeness bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Profile Completeness</span>
            <span className="text-sm text-muted-foreground">{profile.profile_completeness}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${profile.profile_completeness}%` }}
            />
          </div>
        </CardContent>
      </Card>

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
