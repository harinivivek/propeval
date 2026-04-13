"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Receipt,
  Tag,
  Layers,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { AppSidebar, AppHeader, type NavGroup } from "@/components/app-sidebar";
import { WebSocketProvider } from "@/contexts/websocket-provider";
import { useAuth } from "@/hooks/use-auth";

const adminNav: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Users",
    items: [
      { label: "Vendors", href: "/admin/accounts/vendors", icon: Users },
      { label: "Lenders", href: "/admin/accounts/lenders", icon: Building2 },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Billing", href: "/admin/billing", icon: Receipt },
      { label: "Pricing Rules", href: "/admin/pricing", icon: Tag },
      { label: "Price Bands", href: "/admin/price-bands", icon: Layers },
    ],
  },
  {
    title: "Quality",
    items: [
      { label: "Reviews", href: "/admin/quality-reviews", icon: ShieldCheck },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <WebSocketProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar
          portalName="GTR Admin"
          navGroups={adminNav}
          onLogout={logout}
          mobileOpen={sidebarOpen}
          onMobileOpenChange={setSidebarOpen}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader portalName="GTR Admin" onMenuClick={() => setSidebarOpen(true)}>
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
