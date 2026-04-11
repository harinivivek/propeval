"use client";

import { usePushSubscription } from "@/hooks/use-push-subscription";

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
      <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          !
        </div>
        <div>
          <p className="text-sm font-semibold text-red-900">Notifications Blocked</p>
          <p className="text-xs text-red-600">
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
          <p className="text-sm font-semibold text-amber-900">Enable Notifications</p>
          <p className="text-xs text-amber-700">Get alerts when new requests are available</p>
        </div>
      </div>
      <button
        onClick={subscribe}
        className="text-sm bg-amber-500 text-white rounded-md px-4 py-1.5 font-medium hover:bg-amber-600 flex-shrink-0"
      >
        Enable
      </button>
    </div>
  );
}
