"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";

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
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full-screen overlay */}
          <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-center text-gray-500">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-center text-gray-500">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <a
                    key={n.id}
                    href={getNotificationLink(n.reference_type, n.reference_id, user.user_type)}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false); }}
                    className={`block p-4 border-b hover:bg-gray-50 ${!n.is_read ? "bg-blue-50" : ""}`}
                  >
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </a>
                ))
              )}
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <div className="p-3 border-t">
                <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:text-blue-800 w-full text-center">
                  Mark all as read
                </button>
              </div>
            )}
          </div>

          {/* Desktop: dropdown */}
          <div className="hidden md:flex md:flex-col absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border z-50 max-h-[480px]">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <p className="p-4 text-center text-gray-500 text-sm">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <a
                    key={n.id}
                    href={getNotificationLink(n.reference_type, n.reference_id, user.user_type)}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false); }}
                    className={`block px-4 py-3 border-b hover:bg-gray-50 ${!n.is_read ? "bg-blue-50" : ""}`}
                  >
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </a>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
