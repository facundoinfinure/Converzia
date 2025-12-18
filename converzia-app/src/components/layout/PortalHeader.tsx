"use client";

import { useState, useEffect } from "react";
import { Menu, Search, X, ArrowLeft, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CommandPalette } from "@/components/ui/SearchInput";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useImpersonation } from "@/lib/hooks/use-impersonation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PortalHeader() {
  const { profile, activeRole, signOut, activeTenantId } = useAuth();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Impersonation state
  const { isImpersonating, impersonatedTenantName, stopImpersonation } = useImpersonation();

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
    if (!query || query.length < 2 || !activeTenantId) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = createClient();
    const results: any[] = [];

    try {
      // Search leads
      const { data: leads } = await supabase
        .from("lead_offers")
        .select(`
          id,
          lead:leads(full_name, phone, email),
          offer:offers(name)
        `)
        .eq("tenant_id", activeTenantId)
        .or(`lead.full_name.ilike.%${query}%,lead.phone.ilike.%${query}%,lead.email.ilike.%${query}%`)
        .limit(5);

      if (leads) {
        leads.forEach((l: any) => {
          const lead = Array.isArray(l.lead) ? l.lead[0] : l.lead;
          results.push({
            id: `lead-${l.id}`,
            title: lead?.full_name || lead?.phone || "Lead",
            description: `Lead • ${lead?.phone || ""}`,
            category: "Leads",
            icon: <Search className="h-4 w-4" />,
            action: () => router.push(`/portal/leads`),
          });
        });
      }

      // Search offers
      const { data: offers } = await supabase
        .from("offers")
        .select("id, name")
        .eq("tenant_id", activeTenantId)
        .ilike("name", `%${query}%`)
        .limit(5);

      if (offers) {
        offers.forEach((o: any) => {
          results.push({
            id: `offer-${o.id}`,
            title: o.name,
            description: "Oferta",
            category: "Ofertas",
            icon: <Search className="h-4 w-4" />,
            action: () => router.push(`/portal/offers`),
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
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="sticky top-0 z-40 bg-[var(--warning)] text-[var(--warning-dark)]">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">
                Viendo como: <strong>{impersonatedTenantName}</strong>
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={stopImpersonation}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Volver al Admin
            </Button>
          </div>
        </div>
      )}

      <header className={`sticky ${isImpersonating ? 'top-10' : 'top-0'} z-30 h-16 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]`}>
        <div className="flex h-full items-center justify-between px-6">
          {/* Left side */}
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            {/* Mobile menu button */}
            <button className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
              <Menu className="h-5 w-5" />
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Role badge */}
            {activeRole && (
              <Badge variant="secondary" size="sm">
                {activeRole}
              </Badge>
            )}

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
                      {profile?.full_name || "Usuario"}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">{profile?.email}</p>
                  </div>
                </button>
              }
              items={[
                { label: "Mi perfil", onClick: () => router.push("/portal/settings") },
                { label: "Configuración", onClick: () => router.push("/portal/settings") },
                { divider: true, label: "" },
                { label: "Cerrar sesión", onClick: signOut, danger: true },
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
        placeholder="Buscar leads, ofertas..."
      />
    </>
  );
}
