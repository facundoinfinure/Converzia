"use client";

import { useEffect, useRef } from "react";
import { useDashboard } from "@/lib/contexts/dashboard-context";
import { useAuth } from "@/lib/auth/context";

// ============================================
// Types (from centralized stats service)
// ============================================

interface TenantFunnelStatsFromAPI {
  tenantId: string;
  tenantName: string;
  received: number;
  inChat: number;
  qualified: number;
  delivered: number;
  notQualified: number;
  totalLeads: number;
  conversionRate: number;
  creditBalance: number;
  activeOffers: number;
  pipelineStats: {
    pendingMapping: number;
    toBeContacted: number;
    contacted: number;
    engaged: number;
    qualifying: number;
    humanHandoff: number;
    scored: number;
    leadReady: number;
    sentToDeveloper: number;
    cooling: number;
    reactivation: number;
    disqualified: number;
    stopped: number;
  };
}

// ============================================
// Hook: Dashboard Polling (uses centralized stats API)
// ============================================

/**
 * Hook that implements intelligent polling for dashboard data
 * - Uses centralized /api/portal/stats endpoint
 * - Only polls when page is visible (Page Visibility API)
 * - Stops polling when component unmounts or user logs out
 */
export function useDashboardPolling() {
  const { activeTenantId } = useAuth();
  const {
    updateStats,
    updateBilling,
    setLoading,
    lastUpdated,
  } = useDashboard();

  const intervalsRef = useRef<{
    stats?: NodeJS.Timeout;
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
    if (!activeTenantId) {
      return;
    }

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
        // Use centralized stats API
        const response = await fetch(`/api/portal/stats?tenant_id=${activeTenantId}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }
        
        const result = await response.json();
        
        if (result.success && result.data?.tenant) {
          const statsFromAPI = result.data.tenant as TenantFunnelStatsFromAPI;
          
          updateStats({
            totalLeads: statsFromAPI.totalLeads,
            leadReadyCount: statsFromAPI.qualified,
            deliveredCount: statsFromAPI.delivered,
            conversionRate: Math.round(statsFromAPI.conversionRate),
            creditBalance: statsFromAPI.creditBalance,
            activeOffers: statsFromAPI.activeOffers,
            teamMembers: 0, // Keep existing value, don't poll team members
            pipelineStats: {
              contacted: statsFromAPI.inChat,
              qualifying: statsFromAPI.qualified,
              leadReady: statsFromAPI.pipelineStats.leadReady,
              delivered: statsFromAPI.delivered,
            },
          });
          
          // Also update billing with credit balance
          updateBilling({
            balance: statsFromAPI.creditBalance,
            transactions: [], // Keep existing transactions, don't poll them
          });
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
  }, [activeTenantId, updateStats, updateBilling, setLoading, lastUpdated.stats]);

  // Cleanup all intervals on unmount
  useEffect(() => {
    const statsInterval = intervalsRef.current.stats;
    
    return () => {
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, []);
}
