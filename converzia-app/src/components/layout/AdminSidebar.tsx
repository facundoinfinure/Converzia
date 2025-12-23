"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  Megaphone,
  Brain,
  Activity,
  Settings,
  LogOut,
  Zap,
  ChevronDown,
  CreditCard,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUnmappedAds } from "@/lib/hooks/use-ads";
import { usePendingApprovals } from "@/lib/hooks/use-users";
import { BottomNavigation } from "./BottomNavigation";

// ============================================
// Navigation Configuration
// ============================================

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  children?: Array<{
    name: string;
    href: string;
  }>;
}

// Navigation items for sidebar
const baseNavigation: Omit<NavItem, "badge">[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Tenants", href: "/admin/tenants", icon: Building2 },
  { name: "Ofertas", href: "/admin/offers", icon: Package },
  { name: "Mapeo de Ads", href: "/admin/ads-mapping", icon: Megaphone },
  { name: "Knowledge", href: "/admin/knowledge", icon: Brain },
  { name: "Usuarios", href: "/admin/users", icon: Users },
  { name: "Operaciones", href: "/admin/operations", icon: Activity },
  { name: "Facturación", href: "/admin/billing", icon: CreditCard },
];

const bottomNavigation: NavItem[] = [
  { name: "Configuración", href: "/admin/settings", icon: Settings },
];

// Mobile bottom navigation - Most important 5 items
const mobileNavItems = [
  { name: "Inicio", href: "/admin", icon: <LayoutDashboard className="h-5 w-5" /> },
  { name: "Tenants", href: "/admin/tenants", icon: <Building2 className="h-5 w-5" /> },
  { name: "Ofertas", href: "/admin/offers", icon: <Package className="h-5 w-5" /> },
  { name: "Mapeo", href: "/admin/ads-mapping", icon: <Megaphone className="h-5 w-5" /> },
  { name: "Config", href: "/admin/settings", icon: <Settings className="h-5 w-5" /> },
];

// ============================================
// Sidebar Component
// ============================================

export function AdminSidebar() {
  const pathname = usePathname();
  const { total: unmappedAdsCount } = useUnmappedAds();
  const { total: pendingApprovalsCount } = usePendingApprovals();

  // Build navigation with dynamic badges
  const navigation: NavItem[] = baseNavigation.map((item) => {
    if (item.href === "/admin/ads-mapping" && unmappedAdsCount > 0) {
      return { ...item, badge: unmappedAdsCount };
    }
    if (item.href === "/admin/users" && pendingApprovalsCount > 0) {
      return { ...item, badge: pendingApprovalsCount };
    }
    return item;
  });

  // Mobile bottom nav with badges
  const mobileNavWithBadges = mobileNavItems.map((item) => {
    if (item.href === "/admin/ads-mapping" && unmappedAdsCount > 0) {
      return { ...item, badge: unmappedAdsCount };
    }
    return item;
  });

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[var(--z-sidebar)] bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar - Always visible on lg+ */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-[var(--z-sidebar)] h-screen w-64 flex-col",
          "border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]",
          "transition-transform duration-300 ease-out",
          // Hidden on mobile, visible on desktop
          "hidden lg:flex"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-[var(--sidebar-border)] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-purple-500 shadow-lg shadow-[var(--accent-primary)]/25">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] font-[var(--font-display)]">
              Converzia
            </h1>
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">
              Admin Panel
            </p>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide-mobile">
          <div className="space-y-1">
            {navigation.map((item, index) => (
              <NavItemComponent 
                key={item.name} 
                item={item} 
                pathname={pathname}
                style={{ animationDelay: `${index * 30}ms` }}
              />
            ))}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-[var(--sidebar-border)] px-3 py-4 space-y-1">
          {bottomNavigation.map((item) => (
            <NavItemComponent key={item.name} item={item} pathname={pathname} />
          ))}

          <button
            onClick={handleSignOut}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
              "text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error-light)]",
              "transition-all duration-200 active:scale-[0.98]"
            )}
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile Slide-in Menu */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-[var(--z-sidebar)] h-screen w-72 flex-col lg:hidden",
          "border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]",
          "transition-transform duration-300 ease-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile Header */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--sidebar-border)] px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-purple-500">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-[var(--text-primary)]">Converzia</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavItemComponent
                key={item.name}
                item={item}
                pathname={pathname}
                onClick={() => setIsMobileOpen(false)}
              />
            ))}
          </div>
          
          {/* Divider */}
          <div className="my-4 border-t border-[var(--border-primary)]" />
          
          {/* Bottom items in mobile menu */}
          <div className="space-y-1">
            {bottomNavigation.map((item) => (
              <NavItemComponent
                key={item.name}
                item={item}
                pathname={pathname}
                onClick={() => setIsMobileOpen(false)}
              />
            ))}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-all"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <BottomNavigation items={mobileNavWithBadges} />
    </>
  );
}

// ============================================
// Nav Item Component
// ============================================

interface NavItemComponentProps {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

function NavItemComponent({ item, pathname, onClick, style }: NavItemComponentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isActive = pathname === item.href || 
    (item.href !== "/admin" && pathname.startsWith(item.href)) ||
    item.children?.some(child => pathname === child.href);

  const hasChildren = item.children && item.children.length > 0;

  // Auto-expand if a child is active
  const shouldAutoExpand = hasChildren && item.children!.some(child => pathname === child.href);

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else if (onClick) {
      onClick();
    }
  };

  const expanded = isExpanded || shouldAutoExpand;

  if (hasChildren) {
    return (
      <div className="animate-fadeInUp" style={style}>
        <button
          onClick={handleClick}
          className={cn(
            "w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-medium",
            "transition-all duration-200 active:scale-[0.98]",
            isActive
              ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-item-active-text)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-item-hover)]"
          )}
        >
          <div className="flex items-center gap-3">
            <item.icon className={cn("h-5 w-5", isActive && "text-[var(--sidebar-item-active-text)]")} />
            {item.name}
          </div>
          <div className="flex items-center gap-2">
            {item.badge && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--warning-light)] text-[var(--warning-dark)] font-semibold">
                {item.badge}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </div>
        </button>

        <div
          className={cn(
            "overflow-hidden transition-all duration-200",
            expanded ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"
          )}
        >
          <div className="ml-4 pl-4 border-l-2 border-[var(--border-primary)] space-y-1">
            {item.children!.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onClick}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                    isChildActive
                      ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-item-active-text)] font-medium"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-item-hover)]"
                  )}
                >
                  {child.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-medium",
        "transition-all duration-200 active:scale-[0.98]",
        "animate-fadeInUp",
        isActive
          ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-item-active-text)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-item-hover)]"
      )}
      style={style}
    >
      <div className="flex items-center gap-3">
        <item.icon className={cn("h-5 w-5 transition-colors", isActive && "text-[var(--sidebar-item-active-text)]")} />
        {item.name}
      </div>
      {item.badge && (
        <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--warning-light)] text-[var(--warning-dark)] font-semibold animate-pulse">
          {item.badge}
        </span>
      )}
    </Link>
  );
}
