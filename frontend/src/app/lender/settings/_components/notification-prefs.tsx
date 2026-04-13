"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NotificationPreferenceItem, NotificationPreferencesResponse } from "@/types/notification-preference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    return <p className="text-muted-foreground text-sm">Loading preferences...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose which notifications you receive. Disabled notifications will not appear in your notification bell.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {prefs.map((pref) => (
              <div
                key={pref.event_type}
                className="flex items-center justify-between px-6 py-3"
              >
                <span className="text-sm font-medium text-foreground">
                  {EVENT_TYPE_LABELS[pref.event_type] || pref.event_type}
                </span>
                <button
                  onClick={() => togglePref(pref.event_type, pref.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    pref.enabled ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      pref.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
