"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Upload,
  ScrollText,
  Map,
  DollarSign,
  User,
  Settings,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { AppSidebar, AppHeader, type NavGroup } from "@/components/app-sidebar";
import { WebSocketProvider } from "@/contexts/websocket-provider";
import { useAuth } from "@/hooks/use-auth";

const vendorNav: NavGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/vendor/dashboard", icon: LayoutDashboard },
      { label: "Requests", href: "/vendor/requests", icon: FileText },
      { label: "Reports", href: "/vendor/reports/bulk-upload", icon: Upload },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { label: "Listings", href: "/vendor/listings", icon: ScrollText },
      { label: "Coverage Map", href: "/vendor/map", icon: Map },
      { label: "Pricing", href: "/vendor/pricing", icon: DollarSign },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Profile", href: "/vendor/profile", icon: User },
      { label: "Settings", href: "/vendor/settings", icon: Settings },
    ],
  },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <WebSocketProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar
          portalName="Vendor Portal"
          navGroups={vendorNav}
          onLogout={logout}
          mobileOpen={sidebarOpen}
          onMobileOpenChange={setSidebarOpen}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader portalName="Vendor Portal" onMenuClick={() => setSidebarOpen(true)}>
            <NotificationBell />
          </AppHeader>
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </WebSocketProvider>
  );
}
