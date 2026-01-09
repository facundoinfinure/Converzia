"use client";

import { useEffect, useRef } from "react";
import { useAdmin } from "@/lib/contexts/admin-context";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

// ============================================
// Types (from centralized stats service)
// ============================================

interface AdminDashboardStatsFromAPI {
  totalLeads: number;
  leadsToday: number;
  activeTenants: number;
  pendingApprovals: number;
  leadReadyRate: number;
  unmappedAds: number;
  lowCreditTenants: number;
  avgResponseTime: string;
  leadsTrend: Array<{ date: string; value: number }>;
}

// ============================================
// Hook: Admin Polling (uses centralized stats API)
// ============================================

/**
 * Hook that implements intelligent polling for admin dashboard data
 * - Uses centralized /api/admin/stats endpoint
 * - Only polls when page is visible (Page Visibility API)
 * - Stops polling when component unmounts
 */
export function useAdminPolling() {
  const {
    updateStats,
    updateBilling,
    setLoading,
    lastUpdated,
  } = useAdmin();

  const supabase = createClient();
  const intervalsRef = useRef<{
    stats?: NodeJS.Timeout;
    billing?: NodeJS.Timeout;
  }>({});
  const isVisibleRef = useRef(true);

  // Check if page is visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Poll stats every 60 seconds (if page is visible)
  useEffect(() => {
    const pollStats = async () => {
      if (!isVisibleRef.current) {
        return;
      }

      // Don't poll if we just updated recently (within last 30 seconds)
      const lastStatsUpdate = lastUpdated.stats;
      if (lastStatsUpdate && Date.now() - lastStatsUpdate < 30000) {
        return;
      }

      setLoading("stats", true);
      try {
        // Use centralized admin stats API
        const response = await fetch("/api/admin/stats");
        
        if (!response.ok) {
          throw new Error("Failed to fetch admin stats");
        }
        
        const result = await response.json();
        
        if (result.success && result.data?.dashboard) {
          const statsFromAPI = result.data.dashboard as AdminDashboardStatsFromAPI;
          
          // Update stats (preserve leadsTrend if we already have it)
          updateStats((prev) => ({
            ...prev!,
            totalLeads: statsFromAPI.totalLeads,
            activeTenants: statsFromAPI.activeTenants,
            pendingApprovals: statsFromAPI.pendingApprovals,
            leadsToday: statsFromAPI.leadsToday,
            leadReadyRate: statsFromAPI.leadReadyRate,
            unmappedAds: statsFromAPI.unmappedAds,
            lowCreditTenants: statsFromAPI.lowCreditTenants,
            avgResponseTime: statsFromAPI.avgResponseTime,
            // Only update leadsTrend if it's provided (avoid overwriting with empty)
            leadsTrend: statsFromAPI.leadsTrend?.length > 0 
              ? statsFromAPI.leadsTrend 
              : prev?.leadsTrend,
          }));
        }
      } catch (err) {
        console.error("Error polling stats:", err);
        // Don't set error for polling failures - they're non-critical
      } finally {
        setLoading("stats", false);
      }
    };

    // Poll immediately if data is stale (older than 60 seconds)
    const lastStatsUpdate = lastUpdated.stats;
    if (!lastStatsUpdate || Date.now() - lastStatsUpdate > 60000) {
      pollStats();
    }

    // Set up interval for polling every 60 seconds
    const statsInterval = setInterval(pollStats, 60000);
    intervalsRef.current.stats = statsInterval;

    return () => {
      clearInterval(statsInterval);
    };
  }, [updateStats, setLoading, lastUpdated.stats]);

  // Poll billing every 60 seconds (if page is visible)
  useEffect(() => {
    const pollBilling = async () => {
      if (!isVisibleRef.current) {
        return;
      }

      // Don't poll if we just updated recently (within last 30 seconds)
      const lastBillingUpdate = lastUpdated.billing;
      if (lastBillingUpdate && Date.now() - lastBillingUpdate < 30000) {
        return;
      }

      setLoading("billing", true);
      try {
        const [revenueResult, creditsResult] = await Promise.allSettled([
          supabase
            .from("billing_orders")
            .select("total, currency, created_at")
            .eq("status", "completed"),
          queryWithTimeout(
            supabase
              .from("credit_ledger")
              .select("amount")
              .eq("transaction_type", "CREDIT_PURCHASE"),
            10000,
            "poll credit purchases",
            false
          ),
        ]);

        const completedOrders = revenueResult.status === "fulfilled" ? (Array.isArray(revenueResult.value.data) ? revenueResult.value.data : []) : [];
        const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

        const creditPurchases = creditsResult.status === "fulfilled" ? (Array.isArray(creditsResult.value.data) ? creditsResult.value.data : []) : [];
        const creditsSold = creditPurchases.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

        // Update billing stats (preserve existing values)
        updateBilling((prev) => ({
          ...prev,
          stats: prev.stats ? {
            ...prev.stats,
            totalRevenue,
            creditsSold,
          } : null,
        }));
      } catch (err) {
        console.error("Error polling billing:", err);
        // Don't set error for polling failures - they're non-critical
      } finally {
        setLoading("billing", false);
      }
    };

    // Poll immediately if data is stale (older than 60 seconds)
    const lastBillingUpdate = lastUpdated.billing;
    if (!lastBillingUpdate || Date.now() - lastBillingUpdate > 60000) {
      pollBilling();
    }

    // Set up interval for polling every 60 seconds
    const billingInterval = setInterval(pollBilling, 60000);
    intervalsRef.current.billing = billingInterval;

    return () => {
      clearInterval(billingInterval);
    };
  }, [supabase, updateBilling, setLoading, lastUpdated.billing]);

  // Cleanup all intervals on unmount
  useEffect(() => {
    const statsInterval = intervalsRef.current.stats;
    const billingInterval = intervalsRef.current.billing;
    
    return () => {
      if (statsInterval) {
        clearInterval(statsInterval);
      }
      if (billingInterval) {
        clearInterval(billingInterval);
      }
    };
  }, []);
}
