"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { LeadOffer, Offer, CreditLedgerEntry } from "@/types";

// ============================================
// Types
// ============================================

interface DashboardStats {
  totalLeads: number;
  leadReadyCount: number;
  deliveredCount: number;
  conversionRate: number;
  creditBalance: number;
  activeOffers: number;
  teamMembers: number;
  pipelineStats?: {
    contacted: number;
    qualifying: number;
    leadReady: number;
    delivered: number;
  };
}

interface DashboardState {
  // Stats
  stats: DashboardStats | null;
  
  // Recent leads
  recentLeads: LeadOffer[];
  
  // Team members
  teamMembers: Array<{
    id: string;
    user_id: string;
    role: string;
    status: string;
    created_at: string;
    user: { id: string; email: string; full_name: string | null; avatar_url: string | null };
  }>;
  
  // Offers
  offers: (Offer & { lead_count?: number; variant_count?: number })[];
  
  // Billing
  billing: {
    balance: number;
    transactions: CreditLedgerEntry[];
  };
  
  // Loading states
  isInitialLoading: boolean;
  isLoading: {
    stats: boolean;
    leads: boolean;
    team: boolean;
    offers: boolean;
    billing: boolean;
  };
  
  // Errors
  errors: {
    stats: string | null;
    leads: string | null;
    team: string | null;
    offers: string | null;
    billing: string | null;
  };
  
  // Last updated timestamps
  lastUpdated: {
    stats: number | null;
    leads: number | null;
    team: number | null;
    offers: number | null;
    billing: number | null;
  };
}

interface DashboardContextType extends DashboardState {
  // Update methods
  updateStats: (stats: DashboardStats) => void;
  updateRecentLeads: (leads: LeadOffer[]) => void;
  updateTeamMembers: (members: DashboardState["teamMembers"]) => void;
  updateOffers: (offers: DashboardState["offers"]) => void;
  updateBilling: (billing: DashboardState["billing"]) => void;
  
  // Loading state methods
  setInitialLoading: (loading: boolean) => void;
  setLoading: (key: keyof DashboardState["isLoading"], loading: boolean) => void;
  
  // Error methods
  setError: (key: keyof DashboardState["errors"], error: string | null) => void;
  
  // Reset method
  reset: () => void;
  
  // Refresh methods
  refreshStats: () => Promise<void>;
  refreshLeads: () => Promise<void>;
  refreshTeam: () => Promise<void>;
  refreshOffers: () => Promise<void>;
  refreshBilling: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

// ============================================
// Initial State
// ============================================

const initialState: DashboardState = {
  stats: null,
  recentLeads: [],
  teamMembers: [],
  offers: [],
  billing: {
    balance: 0,
    transactions: [],
  },
  isInitialLoading: true,
  isLoading: {
    stats: false,
    leads: false,
    team: false,
    offers: false,
    billing: false,
  },
  errors: {
    stats: null,
    leads: null,
    team: null,
    offers: null,
    billing: null,
  },
  lastUpdated: {
    stats: null,
    leads: null,
    team: null,
    offers: null,
    billing: null,
  },
};

// ============================================
// Context
// ============================================

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const [state, setState] = useState<DashboardState>(initialState);

  // Update methods
  const updateStats = useCallback((stats: DashboardStats) => {
    setState((prev) => ({
      ...prev,
      stats,
      lastUpdated: { ...prev.lastUpdated, stats: Date.now() },
      errors: { ...prev.errors, stats: null },
    }));
  }, []);

  const updateRecentLeads = useCallback((leads: LeadOffer[]) => {
    setState((prev) => ({
      ...prev,
      recentLeads: leads,
      lastUpdated: { ...prev.lastUpdated, leads: Date.now() },
      errors: { ...prev.errors, leads: null },
    }));
  }, []);

  const updateTeamMembers = useCallback((members: DashboardState["teamMembers"]) => {
    setState((prev) => ({
      ...prev,
      teamMembers: members,
      lastUpdated: { ...prev.lastUpdated, team: Date.now() },
      errors: { ...prev.errors, team: null },
    }));
  }, []);

  const updateOffers = useCallback((offers: DashboardState["offers"]) => {
    setState((prev) => ({
      ...prev,
      offers,
      lastUpdated: { ...prev.lastUpdated, offers: Date.now() },
      errors: { ...prev.errors, offers: null },
    }));
  }, []);

  const updateBilling = useCallback((billing: DashboardState["billing"]) => {
    setState((prev) => ({
      ...prev,
      billing,
      lastUpdated: { ...prev.lastUpdated, billing: Date.now() },
      errors: { ...prev.errors, billing: null },
    }));
  }, []);

  // Loading state methods
  const setInitialLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isInitialLoading: loading }));
  }, []);

  const setLoading = useCallback((key: keyof DashboardState["isLoading"], loading: boolean) => {
    setState((prev) => ({
      ...prev,
      isLoading: { ...prev.isLoading, [key]: loading },
    }));
  }, []);

  // Error methods
  const setError = useCallback((key: keyof DashboardState["errors"], error: string | null) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [key]: error },
    }));
  }, []);

  // Reset method
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Refresh methods - these will trigger reloads (implemented by hooks that use this context)
  // For now, they're placeholders - hooks will implement the actual refresh logic
  const refreshStats = useCallback(async () => {
    // Will be implemented by hooks that use this context
    console.log("refreshStats called - implement in hook");
  }, []);

  const refreshLeads = useCallback(async () => {
    // Will be implemented by hooks that use this context
    console.log("refreshLeads called - implement in hook");
  }, []);

  const refreshTeam = useCallback(async () => {
    // Will be implemented by hooks that use this context
    console.log("refreshTeam called - implement in hook");
  }, []);

  const refreshOffers = useCallback(async () => {
    // Will be implemented by hooks that use this context
    console.log("refreshOffers called - implement in hook");
  }, []);

  const refreshBilling = useCallback(async () => {
    // Will be implemented by hooks that use this context
    console.log("refreshBilling called - implement in hook");
  }, []);

  const refreshAll = useCallback(async () => {
    // Will be implemented by hooks that use this context
    await Promise.all([
      refreshStats(),
      refreshLeads(),
      refreshTeam(),
      refreshOffers(),
      refreshBilling(),
    ]);
  }, [refreshStats, refreshLeads, refreshTeam, refreshOffers, refreshBilling]);

  // Method to set refresh callbacks (used by use-dashboard-initial-load)
  const setRefreshCallbacks = useCallback((callbacks: typeof refreshCallbacks) => {
    setRefreshCallbacks(callbacks);
  }, []);

  const value: DashboardContextType = {
    ...state,
    updateStats,
    updateRecentLeads,
    updateTeamMembers,
    updateOffers,
    updateBilling,
    setInitialLoading,
    setLoading,
    setError,
    reset,
    refreshStats,
    refreshLeads,
    refreshTeam,
    refreshOffers,
    refreshBilling,
    refreshAll,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
