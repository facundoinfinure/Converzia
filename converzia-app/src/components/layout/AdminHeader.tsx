"use client";

import { useState } from "react";
import { Bell, Search, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Avatar, UserAvatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { CommandPalette } from "@/components/ui/SearchInput";

export function AdminHeader() {
  const { profile, signOut } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-card-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-full items-center justify-between px-6">
          {/* Left side */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-card-border transition-colors"
            >
              {showMobileMenu ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            {/* Search button */}
            <button
              onClick={() => setShowSearch(true)}
              className="hidden md:flex items-center gap-3 px-4 py-2 rounded-lg bg-card-border/50 text-slate-500 hover:text-slate-400 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Buscar...</span>
              <kbd className="ml-8 px-1.5 py-0.5 text-xs rounded bg-card-border">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-card-border transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary-500" />
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
                      {profile?.full_name || "Admin"}
                    </p>
                    <p className="text-xs text-slate-500">Converzia Admin</p>
                  </div>
                </button>
              }
              items={[
                {
                  label: "Mi perfil",
                  onClick: () => {},
                },
                {
                  label: "Configuración",
                  onClick: () => {},
                },
                { divider: true, label: "" },
                {
                  label: "Cerrar sesión",
                  onClick: signOut,
                  danger: true,
                },
              ]}
            />
          </div>
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSearch={(query) => console.log("Search:", query)}
        placeholder="Buscar tenants, ofertas, leads..."
      />
    </>
  );
}

