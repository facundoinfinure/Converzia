"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ============================================
// Impersonation Hook - Admin viewing as Tenant
// ============================================

const IMPERSONATION_KEY = "converzia-impersonating-tenant";
const IMPERSONATION_NAME_KEY = "converzia-impersonating-tenant-name";

interface ImpersonationState {
  tenantId: string | null;
  tenantName: string | null;
}

interface UseImpersonationReturn {
  isImpersonating: boolean;
  impersonatedTenantId: string | null;
  impersonatedTenantName: string | null;
  startImpersonation: (tenantId: string, tenantName: string) => void;
  stopImpersonation: () => void;
}

/**
 * Hook for managing admin impersonation of tenants
 * Stores state in sessionStorage to persist across page navigations
 * but clear on browser close
 */
export function useImpersonation(): UseImpersonationReturn {
  const router = useRouter();
  const [state, setState] = useState<ImpersonationState>({
    tenantId: null,
    tenantName: null,
  });

  // Initialize from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTenantId = sessionStorage.getItem(IMPERSONATION_KEY);
    const storedTenantName = sessionStorage.getItem(IMPERSONATION_NAME_KEY);

    if (storedTenantId) {
      setState({
        tenantId: storedTenantId,
        tenantName: storedTenantName,
      });
    }
  }, []);

  /**
   * Start impersonating a tenant
   * Saves to sessionStorage and redirects to portal
   */
  const startImpersonation = useCallback(
    (tenantId: string, tenantName: string) => {
      if (typeof window === "undefined") return;

      // Save to sessionStorage
      sessionStorage.setItem(IMPERSONATION_KEY, tenantId);
      sessionStorage.setItem(IMPERSONATION_NAME_KEY, tenantName);

      // Update state
      setState({ tenantId, tenantName });

      // Redirect to portal
      router.push("/portal");
    },
    [router]
  );

  /**
   * Stop impersonating and return to admin
   * Clears sessionStorage and redirects to admin
   */
  const stopImpersonation = useCallback(() => {
    if (typeof window === "undefined") return;

    // Clear sessionStorage
    sessionStorage.removeItem(IMPERSONATION_KEY);
    sessionStorage.removeItem(IMPERSONATION_NAME_KEY);

    // Update state
    setState({ tenantId: null, tenantName: null });

    // Redirect back to admin
    router.push("/admin");
  }, [router]);

  return {
    isImpersonating: !!state.tenantId,
    impersonatedTenantId: state.tenantId,
    impersonatedTenantName: state.tenantName,
    startImpersonation,
    stopImpersonation,
  };
}

/**
 * Get impersonated tenant ID (for server components or non-hook contexts)
 * Returns null if not impersonating or on server
 */
export function getImpersonatedTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(IMPERSONATION_KEY);
}

/**
 * Check if currently impersonating (for server components)
 */
export function isCurrentlyImpersonating(): boolean {
  return !!getImpersonatedTenantId();
}

