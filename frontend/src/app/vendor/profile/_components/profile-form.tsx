"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { VendorProfile } from "@/types/vendor-profile";

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
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Profile Details</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Bio / About</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full border rounded-md p-2 text-sm min-h-[100px]"
            placeholder="Tell lenders about your practice, expertise, and experience..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Founding Year</label>
            <input
              type="number"
              value={foundingYear}
              onChange={(e) => setFoundingYear(e.target.value)}
              className="w-full border rounded-md p-2 text-sm"
              placeholder="e.g., 2015"
              min="1900"
              max={new Date().getFullYear()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">IBBI Registration No.</label>
            <input
              type="text"
              value={ibbiNumber}
              onChange={(e) => setIbbiNumber(e.target.value)}
              className="w-full border rounded-md p-2 text-sm"
              placeholder="IBBI/RV/..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Other Certifications</label>
          <input
            type="text"
            value={otherCerts}
            onChange={(e) => setOtherCerts(e.target.value)}
            className="w-full border rounded-md p-2 text-sm"
            placeholder="e.g., RICS, ISA, other qualifications"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Specialization Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full border rounded-md p-2 text-sm"
            placeholder="Comma-separated: Residential, Commercial, Heritage Properties"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Separate tags with commas. These appear on your public profile.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
