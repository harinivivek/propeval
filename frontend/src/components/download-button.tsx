"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, getApiBaseUrl } from "@/lib/api";
import type { ReportTemplate } from "@/types/template";

interface DownloadButtonProps {
  downloadUrl: string;
  filename?: string;
  className?: string;
}

export default function DownloadButton({ downloadUrl, filename, className }: DownloadButtonProps) {
  const [hasTemplate, setHasTemplate] = useState(false);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ReportTemplate>("/api/lender/templates/active")
      .then(() => setHasTemplate(true))
      .catch(() => setHasTemplate(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownload = useCallback(async (format: "original" | "template") => {
    setDownloading(true);
    setOpen(false);
    try {
      const separator = downloadUrl.includes("?") ? "&" : "?";
      const base = getApiBaseUrl();
      const path = downloadUrl.startsWith("/") ? downloadUrl : `/${downloadUrl}`;
      const url = `${base}${path}${separator}format=${format}`;
      const token = localStorage.getItem("access_token");

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.status === 401 || response.status === 403) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please sign in again.");
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(errText || `Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "report.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Download failed";
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl, filename]);

  const baseClass = className || "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50";

  if (!hasTemplate) {
    return (
      <button onClick={() => handleDownload("original")} disabled={downloading} className={baseClass}>
        {downloading ? "Downloading…" : "Download PDF"}
      </button>
    );
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div className="flex">
        <button
          onClick={() => handleDownload("template")}
          disabled={downloading}
          className={`${baseClass} rounded-r-none`}
        >
          {downloading ? "Downloading…" : "Download (My Template)"}
        </button>
        <button
          onClick={() => setOpen(!open)}
          disabled={downloading}
          className={`${baseClass} rounded-l-none border-l border-blue-500 px-2`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <button
            onClick={() => handleDownload("template")}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
          >
            Download (My Template)
          </button>
          <button
            onClick={() => handleDownload("original")}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg border-t border-gray-100"
          >
            Download (Original)
          </button>
        </div>
      )}
    </div>
  );
}
