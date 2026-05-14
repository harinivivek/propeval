"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

type Props = {
  reportId: string;
  onClose: () => void;
};

export function LenderReportPdfModal({ reportId, onClose }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const base = getApiBaseUrl();
    const path = `/api/reports/${reportId}/download?format=original`;
    const url = base ? `${base.replace(/\/$/, "")}${path}` : path;

    let cancelled = false;
    setLoading(true);
    setPdfUrl(null);

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("access_token");
            window.location.href = "/login";
          }
          throw new Error("Session expired");
        }
        if (!res.ok) {
          return res.text().then((t) => {
            throw new Error(t || `Could not load PDF (${res.status})`);
          });
        }
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setPdfUrl(objectUrl);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load PDF");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [reportId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[min(80vh,720px)] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-semibold text-gray-900">Report PDF</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Loading PDF…
          </div>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} className="flex-1 w-full min-h-0 border-0" title="Report PDF" />
        ) : (
          <div className="flex-1 flex items-center justify-center text-red-600 text-sm px-4 text-center">
            Could not display the PDF. Try Download PDF instead.
          </div>
        )}
      </div>
    </div>
  );
}
