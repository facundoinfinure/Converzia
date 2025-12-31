"use client";

import { useState, useEffect } from "react";
import { Search, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { CommandPalette } from "@/components/ui/SearchInput";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function AdminHeader() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
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
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex w-full items-center justify-between px-4">
          {/* Left side - Sidebar trigger + Search */}
          <div className="flex items-center gap-2">
            {/* Sidebar toggle - desktop only */}
            <SidebarTrigger className="hidden lg:flex -ml-1" />
            <Separator orientation="vertical" className="hidden lg:block h-4 mx-2" />
            
            {/* Search button - pill shaped */}
            <button
              onClick={() => setShowSearch(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md",
                "text-sm text-muted-foreground",
                "border border-input bg-background",
                "hover:bg-accent hover:text-accent-foreground",
                "transition-colors"
              )}
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Buscar...</span>
              <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <ThemeToggle size="sm" />

            {/* Notifications */}
            <NotificationCenter />

            {/* User avatar only - cleaner look */}
            <Dropdown
              align="right"
              trigger={
                <button className="flex items-center p-1 rounded-full hover:bg-accent transition-colors ml-1">
                  <Avatar
                    src={profile?.avatar_url}
                    name={profile?.full_name || profile?.email || "User"}
                    size="sm"
                  />
                </button>
              }
              items={[
                {
                  label: profile?.full_name || profile?.email || "Admin",
                  onClick: () => {},
                  disabled: true,
                },
                { divider: true, label: "" },
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
        placeholder="Buscar tenants, ofertas, leads..."
      />
    </>
  );
}
