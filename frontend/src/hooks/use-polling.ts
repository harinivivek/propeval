"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PollResponse } from "@/types/request";

const POLL_INTERVAL = 30000; // 30 seconds

export function usePolling() {
  const [counts, setCounts] = useState<PollResponse | null>(null);
  const lastCheckedRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      if (!token) return;

      const since = lastCheckedRef.current || "";
      const endpoint = since
        ? `/api/notifications/poll?since=${encodeURIComponent(since)}`
        : "/api/notifications/poll";

      const data = await api.get<PollResponse>(endpoint);
      setCounts(data);
      lastCheckedRef.current = data.last_checked;
    } catch {
      // Silently ignore poll errors
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [poll]);

  return {
    incomingRequests: counts?.incoming_requests ?? 0,
    updatedRequests: counts?.updated_requests ?? 0,
  };
}
