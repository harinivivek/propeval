"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { ReportTemplate } from "@/types/template";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getApiBase() {
  if (typeof window === "undefined") return "http://localhost:8020";
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8020";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020";
}

interface DownloadButtonProps {
  downloadUrl: string;
  filename?: string;
  className?: string;
}

export default function DownloadButton({ downloadUrl, filename, className }: DownloadButtonProps) {
  const [hasTemplate, setHasTemplate] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get<ReportTemplate>("/api/lender/templates/active")
      .then(() => setHasTemplate(true))
      .catch(() => setHasTemplate(false));
  }, []);

  const handleDownload = useCallback(async (format: "original" | "template") => {
    setDownloading(true);
    try {
      const separator = downloadUrl.includes("?") ? "&" : "?";
      const url = `${getApiBase()}${downloadUrl}${separator}format=${format}`;
      const token = localStorage.getItem("access_token");

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "report.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Silently fail — the API layer handles 401 redirects
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl, filename]);

  if (!hasTemplate) {
    return (
      <Button onClick={() => handleDownload("original")} disabled={downloading} className={className}>
        {downloading ? "Downloading\u2026" : "Download PDF"}
      </Button>
    );
  }

  return (
    <div className="inline-flex rounded-md">
      <Button
        onClick={() => handleDownload("template")}
        disabled={downloading}
        className={`rounded-r-none ${className || ""}`}
      >
        {downloading ? "Downloading\u2026" : "Download (My Template)"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={downloading}
          className="inline-flex items-center justify-center rounded-r-md rounded-l-none border-l border-primary-foreground/20 bg-primary px-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 h-9"
        >
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleDownload("template")}>
            Download (My Template)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownload("original")}>
            Download (Original)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
