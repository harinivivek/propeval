"use client";
import { useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { WebSocketProvider } from "@/contexts/websocket-provider";
import { useAuth } from "@/hooks/use-auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <WebSocketProvider>
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 border-r bg-gray-50 p-4 flex-col">
        <h2 className="text-lg font-semibold mb-4">GTR Admin</h2>
        <nav className="space-y-1 text-sm flex-1">
          <a href="/admin/dashboard" className="block px-2 py-3 rounded hover:bg-gray-100">Dashboard</a>
          <a href="/admin/accounts/lenders" className="block px-2 py-3 rounded hover:bg-gray-100">Lenders</a>
          <a href="/admin/accounts/vendors" className="block px-2 py-3 rounded hover:bg-gray-100">Vendors</a>
          <a href="/admin/pricing" className="block px-2 py-3 rounded hover:bg-gray-100">Pricing</a>
          <a href="/admin/billing" className="block px-2 py-3 rounded hover:bg-gray-100">Billing</a>
          <a href="/admin/price-bands" className="block px-2 py-3 rounded hover:bg-gray-100">Price Bands</a>
          <a href="/admin/quality-reviews" className="block px-2 py-3 rounded hover:bg-gray-100">Quality Reviews</a>
          <a href="/admin/settings" className="block px-2 py-3 rounded hover:bg-gray-100">Settings</a>
        </nav>
        <button onClick={logout} className="mt-auto w-full text-left px-2 py-3 text-sm text-red-600 rounded hover:bg-red-50">Logout</button>
      </aside>

      {/* Mobile/tablet overlay sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative z-50 w-64 bg-white border-r shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">GTR Admin</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded hover:bg-gray-100 text-gray-500"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-1 text-sm flex-1">
              <a href="/admin/dashboard" className="block px-2 py-3 rounded hover:bg-gray-100">Dashboard</a>
              <a href="/admin/accounts/lenders" className="block px-2 py-3 rounded hover:bg-gray-100">Lenders</a>
              <a href="/admin/accounts/vendors" className="block px-2 py-3 rounded hover:bg-gray-100">Vendors</a>
              <a href="/admin/pricing" className="block px-2 py-3 rounded hover:bg-gray-100">Pricing</a>
              <a href="/admin/billing" className="block px-2 py-3 rounded hover:bg-gray-100">Billing</a>
              <a href="/admin/price-bands" className="block px-2 py-3 rounded hover:bg-gray-100">Price Bands</a>
              <a href="/admin/quality-reviews" className="block px-2 py-3 rounded hover:bg-gray-100">Quality Reviews</a>
              <a href="/admin/settings" className="block px-2 py-3 rounded hover:bg-gray-100">Settings</a>
            </nav>
            <button onClick={logout} className="mt-auto w-full text-left px-2 py-3 text-sm text-red-600 rounded hover:bg-red-50">Logout</button>
          </aside>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile/tablet top bar */}
        <header className="lg:hidden flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded hover:bg-gray-100 text-gray-600"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-gray-800">GTR Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex items-center justify-end border-b bg-white px-6 py-3">
          <NotificationBell />
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
    </WebSocketProvider>
  );
}
