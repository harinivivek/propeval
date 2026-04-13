"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { VendorProfile } from "@/types/vendor-profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProfileFormProps {
  profile: VendorProfile;
  onSaved: () => void;
}

export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const [bio, setBio] = useState(profile.bio || "");
  const [foundingYear, setFoundingYear] = useState(profile.founding_year?.toString() || "");
  const [ibbiNumber, setIbbiNumber] = useState(profile.certifications?.ibbi_registration || "");
  const [otherCerts, setOtherCerts] = useState(profile.certifications?.other || "");
  const [tags, setTags] = useState(profile.specialization_tags?.join(", ") || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.put("/api/vendor/profile", {
        bio: bio || null,
        founding_year: foundingYear ? parseInt(foundingYear) : null,
        certifications: {
          ibbi_registration: ibbiNumber || null,
          other: otherCerts || null,
        },
        specialization_tags: tags
          ? tags.split(",").map((t) => t.trim()).filter(Boolean)
          : null,
      });
      toast.success("Profile updated successfully");
      onSaved();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1">Bio / About</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="min-h-[100px]"
              placeholder="Tell lenders about your practice, expertise, and experience..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1">Founding Year</Label>
              <Input
                type="number"
                value={foundingYear}
                onChange={(e) => setFoundingYear(e.target.value)}
                placeholder="e.g., 2015"
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
            <div>
              <Label className="mb-1">IBBI Registration No.</Label>
              <Input
                type="text"
                value={ibbiNumber}
                onChange={(e) => setIbbiNumber(e.target.value)}
                placeholder="IBBI/RV/..."
              />
            </div>
          </div>

          <div>
            <Label className="mb-1">Other Certifications</Label>
            <Input
              type="text"
              value={otherCerts}
              onChange={(e) => setOtherCerts(e.target.value)}
              placeholder="e.g., RICS, ISA, other qualifications"
            />
          </div>

          <div>
            <Label className="mb-1">Specialization Tags</Label>
            <Input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated: Residential, Commercial, Heritage Properties"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate tags with commas. These appear on your public profile.
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
