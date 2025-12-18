"use client";

import { useState, useEffect } from "react";
import { Search, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { CommandPalette } from "@/components/ui/SearchInput";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminHeader() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Keyboard shortcut for search (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = createClient();
    const results: any[] = [];

    try {
      // Search tenants
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .ilike("name", `%${query}%`)
        .limit(5);

      if (tenants) {
        tenants.forEach((t: any) => {
          results.push({
            id: `tenant-${t.id}`,
            title: t.name,
            description: `Tenant • ${t.slug}`,
            category: "Tenants",
            icon: <Search className="h-4 w-4" />,
            action: () => router.push(`/admin/tenants/${t.id}`),
          });
        });
      }

      // Search offers
      const { data: offers } = await supabase
        .from("offers")
        .select("id, name, tenant:tenants(name)")
        .ilike("name", `%${query}%`)
        .limit(5);

      if (offers) {
        offers.forEach((o: any) => {
          results.push({
            id: `offer-${o.id}`,
            title: o.name,
            description: `Oferta • ${o.tenant?.name || "Sin tenant"}`,
            category: "Ofertas",
            icon: <Search className="h-4 w-4" />,
            action: () => router.push(`/admin/offers/${o.id}`),
          });
        });
      }

      // Search users
      const { data: users } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5);

      if (users) {
        users.forEach((u: any) => {
          results.push({
            id: `user-${u.id}`,
            title: u.full_name || u.email,
            description: `Usuario • ${u.email}`,
            category: "Usuarios",
            icon: <Search className="h-4 w-4" />,
            action: () => router.push(`/admin/users`),
          });
        });
      }

      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]">
        <div className="flex h-full items-center justify-between px-6">
          {/* Left side */}
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              {showMobileMenu ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            {/* Search bar - Pill shaped */}
            <button
              onClick={() => setShowSearch(true)}
              className="hidden md:flex items-center gap-3 flex-1 max-w-xl px-4 py-2 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)] transition-all text-sm"
            >
              <Search className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Buscar...</span>
              <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] font-medium text-[var(--text-tertiary)]">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <ThemeToggle size="sm" />

            {/* Notifications */}
            <NotificationCenter />

            {/* User menu */}
            <Dropdown
              align="right"
              trigger={
                <button className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors ml-2">
                  <Avatar
                    src={profile?.avatar_url}
                    name={profile?.full_name || profile?.email || "User"}
                    size="sm"
                  />
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {profile?.full_name || "Admin"}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Admin</p>
                  </div>
                </button>
              }
              items={[
                {
                  label: "Mi perfil",
                  onClick: () => router.push("/admin/settings"),
                },
                {
                  label: "Configuración",
                  onClick: () => router.push("/admin/settings"),
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
        onClose={() => {
          setShowSearch(false);
          setSearchResults([]);
        }}
        onSearch={handleSearch}
        results={searchResults}
        isLoading={isSearching}
        placeholder="Buscar tenants, ofertas, leads, usuarios..."
      />
    </>
  );
}
