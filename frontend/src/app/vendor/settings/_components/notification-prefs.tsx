"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NotificationPreferenceItem, NotificationPreferencesResponse } from "@/types/notification-preference";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const EVENT_TYPE_LABELS: Record<string, string> = {
  NEW_BROADCAST: "New broadcast requests",
  REQUEST_ACCEPTED: "Request accepted",
  REVISION_REQUESTED: "Revision requests",
  LISTING_DOWNLOADED: "Listing downloads",
};

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPreferenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await api.get<NotificationPreferencesResponse>("/api/notifications/preferences");
        setPrefs(res.preferences);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const togglePref = async (eventType: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    setPrefs((prev) =>
      prev.map((p) =>
        p.event_type === eventType ? { ...p, enabled: newEnabled } : p
      )
    );
    try {
      await api.patch("/api/notifications/preferences", {
        event_type: eventType,
        enabled: newEnabled,
      });
    } catch {
      setPrefs((prev) =>
        prev.map((p) =>
          p.event_type === eventType ? { ...p, enabled: currentEnabled } : p
        )
      );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification Preferences</CardTitle>
        <CardDescription>
          Choose which notifications you receive. Disabled notifications will not appear in your notification bell.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {prefs.map((pref, index) => (
          <div key={pref.event_type}>
            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-foreground">
                {EVENT_TYPE_LABELS[pref.event_type] || pref.event_type}
              </span>
              <button
                onClick={() => togglePref(pref.event_type, pref.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  pref.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    pref.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {index < prefs.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
