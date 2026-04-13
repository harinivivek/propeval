"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Search,
  ScrollText,
  ShoppingBag,
  Settings,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { AppSidebar, AppHeader, type NavGroup } from "@/components/app-sidebar";
import { WebSocketProvider } from "@/contexts/websocket-provider";
import { useAuth } from "@/hooks/use-auth";

const lenderNav: NavGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/lender/dashboard", icon: LayoutDashboard },
      { label: "Requests", href: "/lender/requests", icon: FileText },
      { label: "Marketplace", href: "/lender/marketplace", icon: Search },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Listings", href: "/lender/listings", icon: ScrollText },
      { label: "Purchased Reports", href: "/lender/listings/purchases", icon: ShoppingBag },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", href: "/lender/settings", icon: Settings },
    ],
  },
];

export default function LenderLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <WebSocketProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar
          portalName="Lender Portal"
          navGroups={lenderNav}
          onLogout={logout}
          mobileOpen={sidebarOpen}
          onMobileOpenChange={setSidebarOpen}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader portalName="Lender Portal" onMenuClick={() => setSidebarOpen(true)}>
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
