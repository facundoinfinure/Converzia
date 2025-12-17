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
  ChevronDown,
  UserCog,
  Building2,
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
  const { memberships, activeTenantId, activeTenant, setActiveTenant, signOut } = useAuth();

  // Tenant options for switcher
  const tenantOptions = memberships.map((m) => ({
    value: m.tenant_id,
    label: m.tenant.name,
    description: m.role,
    icon: <Building2 className="h-4 w-4" />,
  }));

  return (
    <aside className="fixed left-0 top-0 z-40 hidden lg:flex h-screen w-64 flex-col border-r border-card-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-card-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Converzia</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
            Portal
          </p>
        </div>
      </div>

      {/* Tenant Switcher */}
      {memberships.length > 1 && (
        <div className="px-3 py-4 border-b border-card-border">
          <label className="block text-xs text-slate-500 mb-2 px-1">Tenant activo</label>
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
        <div className="px-4 py-4 border-b border-card-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium">
              {activeTenant.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{activeTenant.name}</p>
              <p className="text-xs text-slate-500">/{activeTenant.slug}</p>
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
                    ? "bg-primary-500/10 text-white border border-primary-500/20"
                    : "text-slate-400 hover:text-white hover:bg-card-border"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary-400")} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-card-border px-3 py-4 space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary-500/10 text-white"
                  : "text-slate-400 hover:text-white hover:bg-card-border"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

