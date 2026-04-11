"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useWebSocket } from "@/contexts/websocket-provider";

interface Notification {
  id: string;
  event_type: string;
  title: string;
  message: string;
  reference_id: string;
  reference_type: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const { lastNotification } = useWebSocket();
  const prevNotificationRef = useRef<unknown>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ unread_count: number }>("/api/notifications/unread-count");
      setUnreadCount(res.unread_count);
    } catch {
      // silent
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ notifications: Notification[]; total: number }>(
        "/api/notifications/?page_size=20"
      );
      setNotifications(res.notifications);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/api/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  // Handle real-time WebSocket notifications
  useEffect(() => {
    if (lastNotification && lastNotification !== prevNotificationRef.current) {
      prevNotificationRef.current = lastNotification;
      const notif = lastNotification as Notification & { is_read?: boolean };
      setUnreadCount((c) => c + 1);
      setNotifications((prev) => [
        { ...notif, is_read: false },
        ...prev,
      ]);
    }
  }, [lastNotification]);

  // Polling fallback — reduced to 60s since WebSocket handles real-time
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
