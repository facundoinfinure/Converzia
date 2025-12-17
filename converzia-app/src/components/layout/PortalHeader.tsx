"use client";

import { Bell, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { Badge } from "@/components/ui/Badge";

export function PortalHeader() {
  const { profile, activeRole, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-card-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left side */}
        <div className="flex items-center gap-4 lg:hidden">
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-card-border transition-colors">
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Role badge */}
          {activeRole && (
            <Badge variant="secondary" size="sm">
              {activeRole}
            </Badge>
          )}

          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-card-border transition-colors">
            <Bell className="h-5 w-5" />
          </button>

          {/* User menu */}
          <Dropdown
            align="right"
            trigger={
              <button className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-card-border transition-colors">
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.full_name || profile?.email || "User"}
                  size="sm"
                />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-white">
                    {profile?.full_name || "Usuario"}
                  </p>
                  <p className="text-xs text-slate-500">{profile?.email}</p>
                </div>
              </button>
            }
            items={[
              { label: "Mi perfil", onClick: () => {} },
              { label: "Configuración", onClick: () => {} },
              { divider: true, label: "" },
              { label: "Cerrar sesión", onClick: signOut, danger: true },
            ]}
          />
        </div>
      </div>
    </header>
  );
}

