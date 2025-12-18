"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  CreditCard,
  Settings,
  LogOut,
  Zap,
  UserCog,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { SelectDropdown } from "@/components/ui/Dropdown";

// Navigation items
const navigation = [
  { name: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { name: "Leads", href: "/portal/leads", icon: Users },
  { name: "Mis Ofertas", href: "/portal/offers", icon: Package },
  { name: "Billing", href: "/portal/billing", icon: CreditCard },
  { name: "Equipo", href: "/portal/team", icon: UserCog },
];

const bottomNavigation = [
  { name: "Configuración", href: "/portal/settings", icon: Settings },
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
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 flex-col",
          "border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]",
          "transition-transform duration-300",
          "hidden lg:flex",
          isMobileOpen ? "flex translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-[var(--sidebar-border)] px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-primary)]">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Converzia
            </h1>
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
              Portal
            </p>
          </div>
        </div>

        {/* Tenant Switcher */}
        {memberships.length > 1 && (
          <div className="px-3 py-4 border-b border-[var(--sidebar-border)]">
            <label className="block text-xs text-[var(--text-tertiary)] mb-2 px-1 font-medium">
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

        {/* Current Tenant */}
        {memberships.length === 1 && activeTenant && (
          <div className="px-4 py-4 border-b border-[var(--sidebar-border)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center text-white font-medium text-sm">
                {activeTenant.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
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
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
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
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-[var(--sidebar-border)] px-3 py-4 space-y-1">
          {bottomNavigation.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
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

          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-all"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
