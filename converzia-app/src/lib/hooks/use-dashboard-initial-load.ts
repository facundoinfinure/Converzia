"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useDashboard } from "@/lib/contexts/dashboard-context";
import { useAuth } from "@/lib/auth/context";
import type { LeadOffer, Offer, CreditLedgerEntry } from "@/types";

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

// ============================================
// Hook: Initial Load (uses centralized stats API)
// ============================================

export function useDashboardInitialLoad() {
  const { activeTenantId } = useAuth();
  const {
    isInitialLoading,
    setInitialLoading,
    setLoading,
    setError,
    updateStats,
    updateRecentLeads,
    updateTeamMembers,
    updateOffers,
    updateBilling,
  } = useDashboard();

  const supabase = createClient();

  const loadAllData = useCallback(async () => {
    if (!activeTenantId) {
      setInitialLoading(false);
      return;
    }

    // Set initial loading state
    setInitialLoading(true);
    setError("stats", null);
    setError("leads", null);
    setError("team", null);
    setError("offers", null);
    setError("billing", null);

    try {
      // Load all data in parallel using Promise.allSettled for resilience
      const [
        statsResult,
        teamMembersResult,
        recentLeadsResult,
        offersResult,
        billingResult,
      ] = await Promise.allSettled([
        // 1. Stats from centralized API (includes funnel stats, credit balance, etc.)
        fetch(`/api/portal/stats?tenant_id=${activeTenantId}`).then(async (res) => {
          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || "Error fetching stats");
          }
          return res.json();
        }),

        // 2. Team members count
        queryWithTimeout(
          supabase
            .from("tenant_members")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", activeTenantId)
            .eq("status", "ACTIVE"),
          8000,
          "team members count",
          false
        ),

        // 3. Recent leads (non-blocking, can fail silently)
        queryWithTimeout(
          supabase
            .from("lead_offers")
            .select(`
              *,
              lead:leads(phone, full_name, email),
              offer:offers!lead_offers_offer_id_fkey(name)
            `)
            .eq("tenant_id", activeTenantId)
            .order("created_at", { ascending: false })
            .limit(10),
          8000,
          "recent leads",
          false
        ),

        // 4. Offers (basic info)
        queryWithTimeout(
          supabase
            .from("offers")
            .select("*")
            .eq("tenant_id", activeTenantId)
            .order("priority", { ascending: false }),
          8000,
          "offers",
          false
        ),

        // 5. Billing data (transactions - balance comes from stats API)
        queryWithTimeout(
          supabase
            .from("credit_ledger")
            .select("*")
            .eq("tenant_id", activeTenantId)
            .order("created_at", { ascending: false })
            .limit(20),
          10000,
          "credit ledger",
          false
        ),
      ]);

      // Process stats from API
      let statsFromAPI: TenantFunnelStatsFromAPI | null = null;
      if (statsResult.status === "fulfilled" && statsResult.value.success) {
        statsFromAPI = statsResult.value.data.tenant as TenantFunnelStatsFromAPI;
      } else {
        console.error("Error loading stats:", statsResult);
        setError("stats", "Error al cargar estadísticas");
      }

      // Process team members
      const teamMembersCount =
        teamMembersResult.status === "fulfilled"
          ? teamMembersResult.value.count || 0
          : 0;

      if (teamMembersResult.status === "rejected") {
        setError("team", "Error al cargar miembros del equipo");
      }

      // Build dashboard stats from API response
      const stats: DashboardStats = {
        totalLeads: statsFromAPI?.totalLeads || 0,
        leadReadyCount: statsFromAPI?.qualified || 0,
        deliveredCount: statsFromAPI?.delivered || 0,
        conversionRate: Math.round(statsFromAPI?.conversionRate || 0),
        creditBalance: statsFromAPI?.creditBalance || 0,
        activeOffers: statsFromAPI?.activeOffers || 0,
        teamMembers: teamMembersCount,
        pipelineStats: statsFromAPI ? {
          contacted: statsFromAPI.inChat,
          qualifying: statsFromAPI.qualified,
          leadReady: statsFromAPI.pipelineStats.leadReady,
          delivered: statsFromAPI.delivered,
        } : undefined,
      };

      updateStats(stats);

      // Process recent leads
      if (recentLeadsResult.status === "fulfilled" && recentLeadsResult.value.data) {
        const leadsData = Array.isArray(recentLeadsResult.value.data)
          ? recentLeadsResult.value.data
          : [];

        const processedLeads: LeadOffer[] = leadsData.map((l: any) => ({
          ...l,
          lead: Array.isArray(l.lead) ? l.lead[0] : l.lead,
          offer: Array.isArray(l.offer) ? l.offer[0] : l.offer,
        }));

        updateRecentLeads(processedLeads);
      } else if (recentLeadsResult.status === "rejected") {
        setError("leads", "Error al cargar leads recientes");
      }

      // Process offers
      if (offersResult.status === "fulfilled" && offersResult.value.data) {
        const offersData = Array.isArray(offersResult.value.data)
          ? (offersResult.value.data as Offer[])
          : [];

        // Initialize with empty stats (can be loaded lazily if needed)
        const offersWithStats = offersData.map((offer) => ({
          ...offer,
          lead_count: 0,
          variant_count: 0,
        }));

        updateOffers(offersWithStats);
      } else if (offersResult.status === "rejected") {
        setError("offers", "Error al cargar proyectos");
      }

      // Process billing data
      const transactions =
        billingResult.status === "fulfilled"
          ? (Array.isArray(billingResult.value.data)
              ? billingResult.value.data
              : []) as CreditLedgerEntry[]
          : [];

      // Use credit balance from stats API
      updateBilling({ 
        balance: statsFromAPI?.creditBalance || 0, 
        transactions 
      });

      // Load team members details (non-blocking)
      setLoading("team", true);
      try {
        const { data: membersData } = await queryWithTimeout(
          supabase
            .from("tenant_members")
            .select(`
              id,
              user_id,
              role,
              status,
              created_at,
              user:user_profiles!tenant_members_user_id_fkey(id, email, full_name, avatar_url)
            `)
            .eq("tenant_id", activeTenantId)
            .eq("status", "ACTIVE")
            .order("created_at", { ascending: true }),
          15000,
          "fetch team members",
          false
        );

        if (membersData && Array.isArray(membersData)) {
          const processedMembers = membersData.map((m: any) => ({
            ...m,
            user: Array.isArray(m.user) ? m.user[0] : m.user,
          }));

          updateTeamMembers(processedMembers);
        }
      } catch (err) {
        console.error("Error loading team members:", err);
        setError("team", "Error al cargar miembros del equipo");
      } finally {
        setLoading("team", false);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("stats", "Error al cargar datos del dashboard");
    } finally {
      setInitialLoading(false);
    }
  }, [activeTenantId, supabase, setInitialLoading, setLoading, setError, updateStats, updateRecentLeads, updateTeamMembers, updateOffers, updateBilling]);

  // Load data when activeTenantId changes
  useEffect(() => {
    if (activeTenantId) {
      loadAllData();
    } else {
      setInitialLoading(false);
    }
  }, [activeTenantId, loadAllData, setInitialLoading]);

  return {
    isInitialLoading,
    loadAllData,
  };
}
