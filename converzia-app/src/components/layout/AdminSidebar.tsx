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
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUnmappedAds } from "@/lib/hooks/use-ads";
import { usePendingApprovals } from "@/lib/hooks/use-users";

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

// Navigation items without badges (badges are added dynamically)
const baseNavigation: Omit<NavItem, "badge">[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { 
    name: "Tenants", 
    href: "/admin/tenants", 
    icon: Building2,
    children: [
      { name: "Todos los tenants", href: "/admin/tenants" },
      { name: "Crear tenant", href: "/admin/tenants/new" },
    ]
  },
  { 
    name: "Ofertas", 
    href: "/admin/offers", 
    icon: Package,
    children: [
      { name: "Todas las ofertas", href: "/admin/offers" },
      { name: "Crear oferta", href: "/admin/offers/new" },
    ]
  },
  { name: "Mapeo de Ads", href: "/admin/ads-mapping", icon: Megaphone },
  { 
    name: "Knowledge (RAG)", 
    href: "/admin/knowledge", 
    icon: Brain,
    children: [
      { name: "Fuentes", href: "/admin/knowledge" },
      { name: "Documentos", href: "/admin/knowledge/documents" },
    ]
  },
  { name: "Usuarios", href: "/admin/users", icon: Users },
  { name: "Operaciones", href: "/admin/operations", icon: Activity },
  { name: "Billing", href: "/admin/billing", icon: CreditCard },
];

const bottomNavigation: NavItem[] = [
  { 
    name: "Configuración", 
    href: "/admin/settings", 
    icon: Settings,
    children: [
      { name: "General", href: "/admin/settings" },
      { name: "Integraciones", href: "/admin/settings/integrations" },
      { name: "WhatsApp Templates", href: "/admin/settings/templates" },
    ]
  },
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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-card-border text-slate-400 hover:text-white"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 flex-col border-r border-card-border bg-card transition-transform",
          "hidden lg:flex",
          isMobileOpen ? "flex" : "lg:flex"
        )}
      >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-card-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 shadow-lg shadow-accent-500/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-accent-400 to-primary-400 bg-clip-text text-transparent">
            Converzia
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
            Admin Panel
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => (
            <NavItemComponent key={item.name} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-card-border px-3 py-4 space-y-1">
        {bottomNavigation.map((item) => (
          <NavItemComponent key={item.name} item={item} pathname={pathname} />
        ))}

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// ============================================
// Nav Item Component
// ============================================

interface NavItemComponentProps {
  item: NavItem;
  pathname: string;
}

function NavItemComponent({ item, pathname }: NavItemComponentProps) {
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
    }
  };

  const expanded = isExpanded || shouldAutoExpand;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={handleClick}
          className={cn(
            "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-primary-500/10 text-white"
              : "text-slate-400 hover:text-white hover:bg-card-border"
          )}
        >
          <div className="flex items-center gap-3">
            <item.icon className={cn("h-5 w-5", isActive && "text-primary-400")} />
            {item.name}
          </div>
          <div className="flex items-center gap-2">
            {item.badge && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400">
                {item.badge}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </div>
        </button>

        {expanded && (
          <div className="mt-1 ml-4 pl-4 border-l border-card-border space-y-1">
            {item.children!.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition-all duration-200",
                    isChildActive
                      ? "bg-primary-500/10 text-primary-400"
                      : "text-slate-500 hover:text-white hover:bg-card-border"
                  )}
                >
                  {child.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary-500/10 text-white border border-primary-500/20"
          : "text-slate-400 hover:text-white hover:bg-card-border"
      )}
    >
      <div className="flex items-center gap-3">
        <item.icon className={cn("h-5 w-5", isActive && "text-primary-400")} />
        {item.name}
      </div>
      {item.badge && (
        <span className="px-1.5 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

