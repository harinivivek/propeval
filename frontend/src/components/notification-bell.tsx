"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getNotificationLink(referenceType: string, referenceId: string, userType: string): string {
  if (referenceType === "REQUEST") {
    return userType === "VENDOR"
      ? `/vendor/requests/${referenceId}`
      : `/lender/requests/${referenceId}`;
  }
  return userType === "VENDOR"
    ? `/vendor/reports`
    : `/lender/requests`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, notifications, loading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Mobile: full-screen overlay */}
          <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
            <div className="flex items-center justify-between p-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-2xl">
                &times;
              </button>
            </div>
            <Separator />
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-center text-muted-foreground">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <a
                    key={n.id}
                    href={getNotificationLink(n.reference_type, n.reference_id, user.user_type)}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false); }}
                    className={`block p-4 border-b hover:bg-muted ${!n.is_read ? "bg-secondary" : ""}`}
                  >
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                  </a>
                ))
              )}
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <>
                <Separator />
                <div className="p-3">
                  <button onClick={markAllAsRead} className="text-sm text-primary hover:text-primary/80 w-full text-center">
                    Mark all as read
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Desktop: dropdown */}
          <Card className="hidden md:flex md:flex-col absolute right-0 top-full mt-2 w-96 shadow-lg z-50 max-h-[480px]">
            <div className="flex items-center justify-between p-3">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-primary hover:text-primary/80">
                  Mark all as read
                </button>
              )}
            </div>
            <Separator />
            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <p className="p-4 text-center text-muted-foreground text-sm">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-center text-muted-foreground text-sm">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <a
                    key={n.id}
                    href={getNotificationLink(n.reference_type, n.reference_id, user.user_type)}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false); }}
                    className={`block px-4 py-3 border-b hover:bg-muted ${!n.is_read ? "bg-secondary" : ""}`}
                  >
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                  </a>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
