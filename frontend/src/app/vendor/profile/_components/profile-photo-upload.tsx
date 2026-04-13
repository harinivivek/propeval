"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ProfilePhotoUploadProps {
  currentPhoto: string | null;
  onUploaded: () => void;
}

export function ProfilePhotoUpload({ currentPhoto, onUploaded }: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPEG, PNG, or WebP images are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload("/api/vendor/profile/photo", formData);
      toast.success("Photo uploaded successfully");
      onUploaded();
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const photoUrl = currentPhoto
    ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}${currentPhoto}`
    : null;

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Profile Photo</h2>
      <div className="flex flex-col items-center gap-4">
        <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-300">
          {photoUrl ? (
            <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
              ?
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Change Photo"}
        </button>
      </div>
    </div>
  );
}
