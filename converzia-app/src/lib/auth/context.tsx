"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { sessionManager } from "@/lib/supabase/session-manager";
import { healthMonitor } from "@/lib/supabase/health-check";
import type { User } from "@supabase/supabase-js";
import type { AuthUser, UserProfile, TenantMembership, Permission, UserRole, ROLE_PERMISSIONS } from "@/types";

// ============================================
// Types
// ============================================

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  memberships: TenantMembership[];
  activeTenantId: string | null;
  activeTenant: TenantMembership["tenant"] | null;
  activeRole: UserRole | null;
  isConverziaAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  // Actions
  setActiveTenant: (tenantId: string) => void;
  hasPermission: (permission: Permission) => boolean;
  canAccessTenant: (tenantId: string) => boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ============================================
// Permission Helpers
// ============================================

const PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: ["*"],
  ADMIN: [
    "leads:read",
    "leads:export",
    "offers:read",
    "offers:manage",
    "users:read",
    "users:invite",
    "users:manage",
    "billing:view",
    "settings:read",
  ],
  BILLING: ["leads:read", "billing:view", "billing:manage"],
  VIEWER: ["leads:read", "offers:read"],
};

function checkPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false;
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;
  return rolePermissions.includes("*") || rolePermissions.includes(permission);
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: User | null;
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch user profile and memberships
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      setError(null);

      // Fetch profile
      const { data: profileData, error: profileError } = await queryWithTimeout(
        supabase
          .from("user_profiles")
          .select("*")
          .eq("id", userId)
          .single(),
        10000,
        "fetch user profile"
      );

      if (profileError) {
        // Profile might not exist yet, create it
        if (profileError.code === "PGRST116") {
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const { data: newProfile, error: createError } = await (supabase as any)
              .from("user_profiles")
              .insert({
                id: userId,
                email: userData.user.email || "",
                full_name: userData.user.user_metadata?.full_name || null,
              })
              .select()
              .single();

            if (createError) throw createError;
            setProfile(newProfile as UserProfile);
          }
        } else {
          throw profileError;
        }
      } else {
        setProfile(profileData as UserProfile);
      }

      // Fetch memberships with tenant info
      const { data: membershipsData, error: membershipsError } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .select(`
            id,
            tenant_id,
            user_id,
            role,
            status,
            tenant:tenants (
              id,
              name,
              slug,
              status
            )
          `)
          .eq("user_id", userId)
          .eq("status", "ACTIVE"),
        10000,
        "fetch user memberships"
      );

      if (membershipsError) throw membershipsError;

      const formattedMemberships = (Array.isArray(membershipsData) ? membershipsData : []).map((m: any) => ({
        ...m,
        tenant: Array.isArray(m.tenant) ? m.tenant[0] : m.tenant,
      })) as TenantMembership[];

      setMemberships(formattedMemberships);

      // Set active tenant from localStorage or first membership
      const storedTenantId = localStorage.getItem("activeTenantId");
      if (storedTenantId && formattedMemberships.some((m) => m.tenant_id === storedTenantId)) {
        setActiveTenantId(storedTenantId);
      } else if (formattedMemberships.length > 0) {
        setActiveTenantId(formattedMemberships[0].tenant_id);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
      setError(err instanceof Error ? err.message : "Failed to load user data");
    }
  }, [supabase]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check session health first
        const sessionValid = await sessionManager.checkSession();
        if (!sessionValid) {
          console.log("🔄 Session invalid, attempting refresh...");
          await sessionManager.refreshSession();
        }

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        if (currentUser) {
          await fetchUserData(currentUser.id);
          // Start auto-refresh for authenticated users
          sessionManager.startAutoRefresh();
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Start health monitoring
    healthMonitor.start(30000, (result) => {
      if (!result.connected && !result.authenticated) {
        console.warn("⚠️ Supabase health check failed:", result.error);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserData(currentUser.id);
        // Start auto-refresh for authenticated users
        sessionManager.startAutoRefresh();
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveTenantId(null);
        // Stop auto-refresh when logged out
        sessionManager.stopAutoRefresh();
      }

      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      sessionManager.stopAutoRefresh();
      healthMonitor.stop();
    };
  }, [supabase, fetchUserData]);

  // Set active tenant
  const setActiveTenant = useCallback((tenantId: string) => {
    if (memberships.some((m) => m.tenant_id === tenantId)) {
      setActiveTenantId(tenantId);
      localStorage.setItem("activeTenantId", tenantId);
    }
  }, [memberships]);

  // Get active tenant
  const activeTenant = activeTenantId
    ? memberships.find((m) => m.tenant_id === activeTenantId)?.tenant ?? null
    : null;

  // Get active role
  const activeRole = activeTenantId
    ? memberships.find((m) => m.tenant_id === activeTenantId)?.role ?? null
    : null;

  // Check if user is Converzia admin
  const isConverziaAdmin = profile?.is_converzia_admin ?? false;

  // Check permission
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (isConverziaAdmin) return true;
      return checkPermission(activeRole, permission);
    },
    [isConverziaAdmin, activeRole]
  );

  // Check if user can access a specific tenant
  const canAccessTenant = useCallback(
    (tenantId: string): boolean => {
      if (isConverziaAdmin) return true;
      return memberships.some((m) => m.tenant_id === tenantId && m.status === "ACTIVE");
    },
    [isConverziaAdmin, memberships]
  );

  // Refresh auth data
  const refreshAuth = useCallback(async () => {
    if (user) {
      setIsLoading(true);
      await fetchUserData(user.id);
      setIsLoading(false);
    }
  }, [user, fetchUserData]);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("activeTenantId");
    setUser(null);
    setProfile(null);
    setMemberships([]);
    setActiveTenantId(null);
  }, [supabase]);

  const value: AuthContextType = {
    user,
    profile,
    memberships,
    activeTenantId,
    activeTenant,
    activeRole,
    isConverziaAdmin,
    isLoading,
    error,
    setActiveTenant,
    hasPermission,
    canAccessTenant,
    refreshAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// ============================================
// Utility Hooks
// ============================================

export function useRequireAuth() {
  const auth = useAuth();
  
  if (!auth.isLoading && !auth.user) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  return auth;
}

export function useRequireAdmin() {
  const auth = useAuth();

  if (!auth.isLoading && !auth.isConverziaAdmin) {
    if (typeof window !== "undefined") {
      window.location.href = "/portal";
    }
  }

  return auth;
}

export function useRequireTenant() {
  const auth = useAuth();

  if (!auth.isLoading && !auth.activeTenantId && !auth.isConverziaAdmin) {
    if (typeof window !== "undefined") {
      window.location.href = "/no-access";
    }
  }

  return auth;
}








