"use client";
import { useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 border-r bg-gray-50 p-4 flex-col">
        <h2 className="text-lg font-semibold mb-4">GTR Admin</h2>
        <nav className="space-y-1 text-sm">
          <a href="/admin/dashboard" className="block px-2 py-3 rounded hover:bg-gray-100">Dashboard</a>
          <a href="/admin/accounts/lenders" className="block px-2 py-3 rounded hover:bg-gray-100">Lenders</a>
          <a href="/admin/accounts/vendors" className="block px-2 py-3 rounded hover:bg-gray-100">Vendors</a>
          <a href="/admin/pricing" className="block px-2 py-3 rounded hover:bg-gray-100">Pricing</a>
        </nav>
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
            <nav className="space-y-1 text-sm">
              <a href="/admin/dashboard" className="block px-2 py-3 rounded hover:bg-gray-100">Dashboard</a>
              <a href="/admin/accounts/lenders" className="block px-2 py-3 rounded hover:bg-gray-100">Lenders</a>
              <a href="/admin/accounts/vendors" className="block px-2 py-3 rounded hover:bg-gray-100">Vendors</a>
              <a href="/admin/pricing" className="block px-2 py-3 rounded hover:bg-gray-100">Pricing</a>
            </nav>
          </aside>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile/tablet top bar */}
        <header className="lg:hidden flex items-center gap-3 border-b bg-white px-4 py-3">
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
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
