"use client";

import { useEffect, useRef } from "react";
import { useDashboard } from "@/lib/contexts/dashboard-context";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

// ============================================
// Hook: Dashboard Polling
// ============================================

/**
 * Hook that implements intelligent polling for dashboard data
 * - Only polls when page is visible (Page Visibility API)
 * - Different intervals for different data types
 * - Stops polling when component unmounts or user logs out
 */
export function useDashboardPolling() {
  const { activeTenantId } = useAuth();
  const {
    updateStats,
    updateBilling,
    setLoading,
    setError,
    lastUpdated,
  } = useDashboard();

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
        const { data: funnelStatsData } = await queryWithTimeout(
          supabase
            .from("tenant_funnel_stats")
            .select("*")
            .eq("tenant_id", activeTenantId)
            .maybeSingle(),
          10000,
          "poll tenant funnel stats",
          false
        );

        if (funnelStatsData) {
          const funnelStats = funnelStatsData as any;
          const totalLeads = funnelStats.total_leads || 0;
          const deliveredCount = funnelStats.leads_delivered || 0;
          const leadReadyCount = funnelStats.leads_qualified || 0;
          const conversionRate =
            funnelStats.conversion_rate ||
            (totalLeads > 0 ? Math.round((deliveredCount / totalLeads) * 100) : 0);

          updateStats({
            totalLeads,
            leadReadyCount,
            deliveredCount,
            conversionRate: Math.round(conversionRate),
            creditBalance: funnelStats.credit_balance || 0,
            activeOffers: funnelStats.active_offers_count || 0,
            teamMembers: 0, // Keep existing value, don't poll team members
            pipelineStats: {
              contacted: 0, // Keep existing value
              qualifying: 0, // Keep existing value
              leadReady: leadReadyCount,
              delivered: deliveredCount,
            },
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
    intervalsRef.current.stats = setInterval(pollStats, 60000);

    return () => {
      if (intervalsRef.current.stats) {
        clearInterval(intervalsRef.current.stats);
      }
    };
  }, [activeTenantId, supabase, updateStats, setLoading, lastUpdated.stats]);

  // Poll billing (credit balance) every 30 seconds (if page is visible)
  useEffect(() => {
    if (!activeTenantId) {
      return;
    }

    const pollBilling = async () => {
      if (!isVisibleRef.current) {
        return;
      }

      // Don't poll if we just updated recently (within last 15 seconds)
      const lastBillingUpdate = lastUpdated.billing;
      if (lastBillingUpdate && Date.now() - lastBillingUpdate < 15000) {
        return;
      }

      setLoading("billing", true);
      try {
        const { data: balanceData } = await queryWithTimeout(
          supabase
            .from("tenant_credit_balance")
            .select("current_balance")
            .eq("tenant_id", activeTenantId)
            .maybeSingle(),
          10000,
          "poll credit balance",
          false
        );

        if (balanceData) {
          const balance = (balanceData as any)?.current_balance || 0;
          updateBilling({
            balance,
            transactions: [], // Keep existing transactions, don't poll them
          });

          // Also update credit balance in stats
          // This will be handled by the stats update, but we can do it here too for immediate update
        }
      } catch (err) {
        console.error("Error polling billing:", err);
        // Don't set error for polling failures - they're non-critical
      } finally {
        setLoading("billing", false);
      }
    };

    // Poll immediately if data is stale (older than 30 seconds)
    const lastBillingUpdate = lastUpdated.billing;
    if (!lastBillingUpdate || Date.now() - lastBillingUpdate > 30000) {
      pollBilling();
    }

    // Set up interval for polling every 30 seconds
    intervalsRef.current.billing = setInterval(pollBilling, 30000);

    return () => {
      if (intervalsRef.current.billing) {
        clearInterval(intervalsRef.current.billing);
      }
    };
  }, [activeTenantId, supabase, updateBilling, setLoading, lastUpdated.billing]);

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalsRef.current.stats) {
        clearInterval(intervalsRef.current.stats);
      }
      if (intervalsRef.current.billing) {
        clearInterval(intervalsRef.current.billing);
      }
    };
  }, []);
}
