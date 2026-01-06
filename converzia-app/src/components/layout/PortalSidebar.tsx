"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  CreditCard,
  LogOut,
  Zap,
  UserCog,
  Building2,
  X,
  Users,
  Settings,
  Plug,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { SelectDropdown } from "@/components/ui/Dropdown";
import { BottomNavigation } from "./BottomNavigation";

// Navigation items - simplified for tenant portal
const navigation = [
  { name: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { name: "Mis Proyectos", href: "/portal/offers", icon: Package },
  { name: "Mis Leads", href: "/portal/leads", icon: Users },
  { name: "Facturación", href: "/portal/billing", icon: CreditCard },
  { name: "Equipo", href: "/portal/team", icon: UserCog },
  { name: "Integraciones", href: "/portal/integrations", icon: Plug },
  { name: "Configuración", href: "/portal/settings", icon: Settings },
];

// Mobile bottom navigation
const mobileNavItems = [
  { name: "Inicio", href: "/portal", icon: <LayoutDashboard className="h-5 w-5" /> },
  { name: "Proyectos", href: "/portal/offers", icon: <Package className="h-5 w-5" /> },
  { name: "Leads", href: "/portal/leads", icon: <Users className="h-5 w-5" /> },
  { name: "Billing", href: "/portal/billing", icon: <CreditCard className="h-5 w-5" /> },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { memberships, activeTenantId, activeTenant, setActiveTenant, signOut } = useAuth();

  // Tenant options for switcher
  const tenantOptions = memberships.map((m) => ({
    value: m.tenant_id,
    label: m.tenant.name,
    description: m.role,
    icon: <Building2 className="h-4 w-4" />,
  }));

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[var(--z-sidebar)] bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-[var(--z-sidebar)] h-screen w-64 flex-col",
          "border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]",
          "transition-transform duration-300 ease-out",
          "hidden lg:flex"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-[var(--sidebar-border)] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-purple-500 shadow-lg shadow-[var(--accent-primary)]/25">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              Converzia
            </h1>
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">
              Portal
            </p>
          </div>
        </div>

        {/* Tenant Switcher */}
        {memberships.length > 1 && (
          <div className="px-4 py-4 border-b border-[var(--sidebar-border)]">
            <label className="block text-xs text-[var(--text-tertiary)] mb-2 px-1 font-medium uppercase tracking-wide">
              Tenant activo
            </label>
            <SelectDropdown
              value={activeTenantId || ""}
              onChange={setActiveTenant}
              options={tenantOptions}
              placeholder="Seleccionar tenant"
            />
          </div>
        )}

        {/* Current Tenant - Single tenant view */}
        {memberships.length === 1 && activeTenant && (
          <div className="px-4 py-4 border-b border-[var(--sidebar-border)]">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {activeTenant.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {activeTenant.name}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  /{activeTenant.slug}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide-mobile">
          <div className="space-y-1">
            {navigation.map((item, index) => {
              const isActive = item.href === "/portal"
                ? pathname === "/portal"
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                    "transition-all duration-200 active:scale-[0.98]",
                    "animate-fadeInUp",
                    isActive
                      ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-item-active-text)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-item-hover)]"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <item.icon className={cn("h-5 w-5 transition-colors", isActive && "text-[var(--sidebar-item-active-text)]")} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sign Out */}
        <div className="border-t border-[var(--sidebar-border)] px-3 py-4">
          <button
            onClick={signOut}
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

        {/* Mobile Tenant Display */}
        {activeTenant && (
          <div className="px-4 py-4 border-b border-[var(--sidebar-border)]">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                {activeTenant.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {activeTenant.name}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  /{activeTenant.slug}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = item.href === "/portal"
                ? pathname === "/portal"
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                    "transition-all duration-200 active:scale-[0.98]",
                    isActive
                      ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-item-active-text)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-item-hover)]"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "text-[var(--sidebar-item-active-text)]")} />
                  {item.name}
                </Link>
              );
            })}
          </div>
          
          <div className="my-4 border-t border-[var(--border-primary)]" />
          
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-all"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <BottomNavigation items={mobileNavItems} />
    </>
  );
}
