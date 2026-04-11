"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subscribingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (subscribingRef.current) return;
    subscribingRef.current = true;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        subscribingRef.current = false;
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const vapidRes = await api.get<{ public_key: string }>("/api/push/vapid-key");
      const applicationServerKey = urlBase64ToUint8Array(vapidRes.public_key);

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJson = subscription.toJSON();
      await api.post("/api/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh || "",
          auth: subJson.keys?.auth || "",
        },
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      subscribingRef.current = false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        try {
          await api.post("/api/push/unsubscribe", { endpoint });
        } catch {
          // Best effort — user may be logging out
        }
        setIsSubscribed(false);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (permission === "granted" && !isSubscribed && "serviceWorker" in navigator) {
      const checkExisting = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            setIsSubscribed(true);
            const subJson = subscription.toJSON();
            await api.post("/api/push/subscribe", {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh || "",
                auth: subJson.keys?.auth || "",
              },
            });
          }
        } catch {
          // silent
        }
      };
      checkExisting();
    }
  }, [permission, isSubscribed]);

  return { permission, isSubscribed, subscribe, unsubscribe };
}
