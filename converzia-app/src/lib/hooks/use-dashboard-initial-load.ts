"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useDashboard } from "@/lib/contexts/dashboard-context";
import { useAuth } from "@/lib/auth/context";
import type { LeadOffer, Offer, CreditLedgerEntry } from "@/types";

// ============================================
// Types
// ============================================

interface TenantFunnelStats {
  tenant_id: string;
  tenant_name: string;
  total_leads: number;
  leads_pending_mapping: number;
  leads_pending_contact: number;
  leads_in_chat: number;
  leads_qualified: number;
  leads_delivered: number;
  leads_disqualified: number;
  leads_stopped: number;
  conversion_rate: number;
  credit_balance: number;
  active_offers_count: number;
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
// Hook: Initial Load
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
        funnelStatsResult,
        teamMembersResult,
        contactedCountResult,
        qualifyingCountResult,
        recentLeadsResult,
        offersResult,
        billingResult,
      ] = await Promise.allSettled([
        // 1. Funnel stats (includes credit balance)
        queryWithTimeout(
          supabase
            .from("tenant_funnel_stats")
            .select("*")
            .eq("tenant_id", activeTenantId)
            .maybeSingle(),
          10000,
          "tenant funnel stats",
          false
        ),

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

        // 3. Contacted count (for pipeline stats)
        queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", activeTenantId)
            .in("status", ["CONTACTED", "ENGAGED"]),
          8000,
          "contacted count",
          false
        ),

        // 4. Qualifying count (for pipeline stats)
        queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", activeTenantId)
            .eq("status", "QUALIFYING"),
          8000,
          "qualifying count",
          false
        ),

        // 5. Recent leads (non-blocking, can fail silently)
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

        // 6. Offers (basic info, stats can be loaded lazily)
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

        // 7. Billing data (balance and recent transactions)
        Promise.allSettled([
          queryWithTimeout(
            supabase
              .from("tenant_credit_balance")
              .select("current_balance")
              .eq("tenant_id", activeTenantId)
              .maybeSingle(),
            10000,
            "credit balance",
            false
          ),
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
        ]),
      ]);

      // Process funnel stats
      const funnelStats: TenantFunnelStats | null =
        funnelStatsResult.status === "fulfilled"
          ? (funnelStatsResult.value.data as TenantFunnelStats)
          : null;

      if (funnelStatsResult.status === "rejected") {
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

      // Process pipeline counts
      const contactedCount =
        contactedCountResult.status === "fulfilled"
          ? contactedCountResult.value.count || 0
          : 0;

      const qualifyingCount =
        qualifyingCountResult.status === "fulfilled"
          ? qualifyingCountResult.value.count || 0
          : 0;

      // Build dashboard stats
      const totalLeads = funnelStats?.total_leads || 0;
      const deliveredCount = funnelStats?.leads_delivered || 0;
      const leadReadyCount = funnelStats?.leads_qualified || 0;
      const conversionRate =
        funnelStats?.conversion_rate ||
        (totalLeads > 0 ? Math.round((deliveredCount / totalLeads) * 100) : 0);

      const stats: DashboardStats = {
        totalLeads,
        leadReadyCount,
        deliveredCount,
        conversionRate: Math.round(conversionRate),
        creditBalance: funnelStats?.credit_balance || 0,
        activeOffers: funnelStats?.active_offers_count || 0,
        teamMembers: teamMembersCount,
        pipelineStats: {
          contacted: contactedCount,
          qualifying: qualifyingCount,
          leadReady: leadReadyCount,
          delivered: deliveredCount,
        },
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
      if (billingResult.status === "fulfilled") {
        const [balanceResult, transactionsResult] = billingResult.value;

        const balance =
          balanceResult.status === "fulfilled"
            ? (balanceResult.value.data as any)?.current_balance || 0
            : 0;

        const transactions =
          transactionsResult.status === "fulfilled"
            ? (Array.isArray(transactionsResult.value.data)
                ? transactionsResult.value.data
                : []) as CreditLedgerEntry[]
            : [];

        updateBilling({ balance, transactions });

        // Also update credit balance in stats if it's different
        if (balance !== stats.creditBalance) {
          updateStats({ ...stats, creditBalance: balance });
        }
      } else if (billingResult.status === "rejected") {
        setError("billing", "Error al cargar datos de facturación");
      }

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
