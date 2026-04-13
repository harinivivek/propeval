"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarContentProps {
  portalName: string;
  navGroups: NavGroup[];
  onLogout: () => void;
  pathname: string;
  onNavigate?: () => void;
}

function SidebarContent({
  portalName,
  navGroups,
  onLogout,
  pathname,
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">PropEval</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{portalName}</p>
      </div>

      <Separator />

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                      isActive
                        ? "bg-secondary text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Separator />

      <div className="px-3 py-4">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors duration-150 w-full"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

interface AppSidebarProps {
  portalName: string;
  navGroups: NavGroup[];
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function AppSidebar({
  portalName,
  navGroups,
  onLogout,
  mobileOpen,
  onMobileOpenChange,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 border-r border-border bg-sidebar-background flex-col">
        <SidebarContent
          portalName={portalName}
          navGroups={navGroups}
          onLogout={onLogout}
          pathname={pathname}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetTitle className="sr-only">{portalName} Navigation</SheetTitle>
          <SidebarContent
            portalName={portalName}
            navGroups={navGroups}
            onLogout={onLogout}
            pathname={pathname}
            onNavigate={() => onMobileOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function AppHeader({
  portalName,
  onMenuClick,
  children,
}: {
  portalName: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className="lg:hidden flex items-center justify-between border-b border-border bg-card px-4 h-14">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-foreground">{portalName}</span>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </header>

      <header className="hidden lg:flex items-center justify-end border-b border-border bg-card px-6 h-14">
        {children}
      </header>
    </>
  );
}
