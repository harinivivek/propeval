"use client";

import { usePushSubscription } from "@/hooks/use-push-subscription";
import { Button } from "@/components/ui/button";

export function NotificationBanner() {
  const { permission, subscribe } = usePushSubscription();

  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }

  if (permission === "granted") {
    return null;
  }

  if (permission === "denied") {
    return (
      <div className="mb-4 bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-destructive rounded-lg flex items-center justify-center text-destructive-foreground font-bold text-sm flex-shrink-0">
          !
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Notifications Blocked</p>
          <p className="text-xs text-destructive">
            You may miss new requests. Go to browser settings &rarr; Site settings &rarr; Notifications to enable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0">
          &#x1f514;
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Enable Notifications</p>
          <p className="text-xs text-amber-700">Get alerts when new requests are available</p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={subscribe}
        className="bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0"
      >
        Enable
      </Button>
    </div>
  );
}
