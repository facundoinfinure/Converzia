"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ============================================
// Types
// ============================================

interface AdminDashboardStats {
  totalLeads: number;
  leadsToday: number;
  activeTenants: number;
  leadReadyRate: number;
  avgResponseTime: string;
  pendingApprovals: number;
  unmappedAds: number;
  lowCreditTenants: number;
  leadsTrend?: Array<{ date: string; value: number }>;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

interface PendingApproval {
  id: string;
  tenant_id: string;
  user_id: string;
  tenant_name: string;
  user_email: string;
  user_name: string | null;
  requested_at: string;
}

interface BillingStats {
  totalRevenue: number;
  creditsSold: number;
  activeTenants: number;
  pendingPayments: number;
}

interface BillingOrder {
  id: string;
  tenant_id: string;
  tenant_name: string;
  total: number;
  currency: string;
  status: string;
  created_at: string;
}

interface AdminState {
  // Dashboard stats
  stats: AdminDashboardStats | null;
  
  // Recent activity
  recentActivity: RecentActivity[];
  
  // Pending approvals
  pendingApprovals: PendingApproval[];
  
  // Billing
  billing: {
    stats: BillingStats | null;
    orders: BillingOrder[];
  };
  
  // Loading states
  isInitialLoading: boolean;
  isLoading: {
    stats: boolean;
    activity: boolean;
    approvals: boolean;
    billing: boolean;
  };
  
  // Errors
  errors: {
    stats: string | null;
    activity: string | null;
    approvals: string | null;
    billing: string | null;
  };
  
  // Last updated timestamps
  lastUpdated: {
    stats: number | null;
    activity: number | null;
    approvals: number | null;
    billing: number | null;
  };
}

interface AdminContextType extends AdminState {
  // Update methods
  updateStats: (stats: AdminDashboardStats) => void;
  updateRecentActivity: (activity: RecentActivity[]) => void;
  updatePendingApprovals: (approvals: PendingApproval[]) => void;
  updateBilling: (billing: AdminState["billing"]) => void;
  
  // Loading state methods
  setInitialLoading: (loading: boolean) => void;
  setLoading: (key: keyof AdminState["isLoading"], loading: boolean) => void;
  
  // Error methods
  setError: (key: keyof AdminState["errors"], error: string | null) => void;
  
  // Reset method
  reset: () => void;
  
  // Refresh methods
  refreshStats: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  refreshApprovals: () => Promise<void>;
  refreshBilling: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

// ============================================
// Initial State
// ============================================

const initialState: AdminState = {
  stats: null,
  recentActivity: [],
  pendingApprovals: [],
  billing: {
    stats: null,
    orders: [],
  },
  isInitialLoading: true,
  isLoading: {
    stats: false,
    activity: false,
    approvals: false,
    billing: false,
  },
  errors: {
    stats: null,
    activity: null,
    approvals: null,
    billing: null,
  },
  lastUpdated: {
    stats: null,
    activity: null,
    approvals: null,
    billing: null,
  },
};

// ============================================
// Context
// ============================================

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface AdminProviderProps {
  children: ReactNode;
}

export function AdminProvider({ children }: AdminProviderProps) {
  const [state, setState] = useState<AdminState>(initialState);

  // Update methods
  const updateStats = useCallback((stats: AdminDashboardStats) => {
    setState((prev) => ({
      ...prev,
      stats,
      lastUpdated: { ...prev.lastUpdated, stats: Date.now() },
      errors: { ...prev.errors, stats: null },
    }));
  }, []);

  const updateRecentActivity = useCallback((activity: RecentActivity[]) => {
    setState((prev) => ({
      ...prev,
      recentActivity: activity,
      lastUpdated: { ...prev.lastUpdated, activity: Date.now() },
      errors: { ...prev.errors, activity: null },
    }));
  }, []);

  const updatePendingApprovals = useCallback((approvals: PendingApproval[]) => {
    setState((prev) => ({
      ...prev,
      pendingApprovals: approvals,
      lastUpdated: { ...prev.lastUpdated, approvals: Date.now() },
      errors: { ...prev.errors, approvals: null },
    }));
  }, []);

  const updateBilling = useCallback((billing: AdminState["billing"]) => {
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

  const setLoading = useCallback((key: keyof AdminState["isLoading"], loading: boolean) => {
    setState((prev) => ({
      ...prev,
      isLoading: { ...prev.isLoading, [key]: loading },
    }));
  }, []);

  // Error methods
  const setError = useCallback((key: keyof AdminState["errors"], error: string | null) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [key]: error },
    }));
  }, []);

  // Reset method
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Refresh methods - will be implemented by hooks
  const refreshStats = useCallback(async () => {
    console.log("refreshStats called - implement in hook");
  }, []);

  const refreshActivity = useCallback(async () => {
    console.log("refreshActivity called - implement in hook");
  }, []);

  const refreshApprovals = useCallback(async () => {
    console.log("refreshApprovals called - implement in hook");
  }, []);

  const refreshBilling = useCallback(async () => {
    console.log("refreshBilling called - implement in hook");
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshStats(),
      refreshActivity(),
      refreshApprovals(),
      refreshBilling(),
    ]);
  }, [refreshStats, refreshActivity, refreshApprovals, refreshBilling]);

  const value: AdminContextType = {
    ...state,
    updateStats,
    updateRecentActivity,
    updatePendingApprovals,
    updateBilling,
    setInitialLoading,
    setLoading,
    setError,
    reset,
    refreshStats,
    refreshActivity,
    refreshApprovals,
    refreshBilling,
    refreshAll,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
