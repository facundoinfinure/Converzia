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
  CreditCard,
  TrendingUp,
  ChevronLeft,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUnmappedAds } from "@/lib/hooks/use-ads";
import { usePendingApprovalsContext } from "@/contexts/PendingApprovalsContext";
import { BottomNavigation } from "./BottomNavigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth/context";

// ============================================
// Navigation Configuration
// ============================================

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const mainNavigation: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Tenants", href: "/admin/tenants", icon: Building2 },
  { name: "Ofertas", href: "/admin/offers", icon: Package },
  { name: "Mapeo de Ads", href: "/admin/ads-mapping", icon: Megaphone },
  { name: "Knowledge", href: "/admin/knowledge", icon: Brain },
  { name: "Usuarios", href: "/admin/users", icon: Users },
];

const operationsNavigation: NavItem[] = [
  { name: "Operaciones", href: "/admin/operations", icon: Activity },
  { name: "Revenue", href: "/admin/revenue", icon: TrendingUp },
  { name: "Facturación", href: "/admin/billing", icon: CreditCard },
  { name: "Audit Logs", href: "/admin/audit", icon: FileText },
];

// Mobile bottom navigation
const mobileNavItems = [
  { name: "Inicio", href: "/admin", icon: <LayoutDashboard className="h-5 w-5" /> },
  { name: "Tenants", href: "/admin/tenants", icon: <Building2 className="h-5 w-5" /> },
  { name: "Ofertas", href: "/admin/offers", icon: <Package className="h-5 w-5" /> },
  { name: "Mapeo", href: "/admin/ads-mapping", icon: <Megaphone className="h-5 w-5" /> },
  { name: "Config", href: "/admin/settings", icon: <Settings className="h-5 w-5" /> },
];

// ============================================
// Sidebar Content Component
// ============================================

function AdminSidebarContent() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { user } = useAuth();
  const { total: unmappedAdsCount } = useUnmappedAds();
  const { total: pendingApprovalsCount } = usePendingApprovalsContext();
  
  const isCollapsed = state === "collapsed";

  // Build navigation with dynamic badges
  const mainNav = mainNavigation.map((item) => {
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

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold tracking-tight">
              Converzia
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge && item.badge > 0 && (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
            ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Operations Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsNavigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
          ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/admin/settings")}
                  tooltip="Configuración"
                >
                  <Link href="/admin/settings">
                    <Settings className="h-4 w-4" />
                    <span>Configuración</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {user?.email?.slice(0, 2).toUpperCase() || "AD"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex flex-col items-start text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {user?.email?.split("@")[0] || "Admin"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        Administrador
                      </span>
        </div>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-56"
              >
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
          >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

// ============================================
// Main Sidebar Export
// ============================================

export function AdminSidebar() {
  const { total: unmappedAdsCount } = useUnmappedAds();

  // Mobile bottom nav with badges
  const mobileNavWithBadges = mobileNavItems.map((item) => {
    if (item.href === "/admin/ads-mapping" && unmappedAdsCount > 0) {
      return { ...item, badge: unmappedAdsCount };
    }
    return item;
  });

  return (
    <>
      {/* Desktop Sidebar */}
      <Sidebar collapsible="icon" className="hidden lg:flex">
        <AdminSidebarContent />
      </Sidebar>

      {/* Mobile Bottom Navigation */}
      <BottomNavigation items={mobileNavWithBadges} />
    </>
  );
}

// ============================================
// Sidebar Layout Wrapper
// ============================================

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      {children}
    </SidebarProvider>
  );
}

// Re-export trigger for header
export { SidebarTrigger };
