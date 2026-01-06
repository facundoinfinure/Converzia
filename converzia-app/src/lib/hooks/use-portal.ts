"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useAuth } from "@/lib/auth/context";
import type { LeadOffer, Offer, Delivery, CreditLedgerEntry, TenantMembership } from "@/types";

// ============================================
// Hook: Portal Dashboard Stats
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

export function usePortalDashboard() {
  const { activeTenantId } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<LeadOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!activeTenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch critical stats in parallel with shorter timeouts and better error handling
      // Use Promise.allSettled to prevent one failure from blocking all data
      const [
        totalLeadsResult,
        leadReadyResult,
        deliveredResult,
        creditResult,
        offersResult,
        membersResult,
        contactedResult,
        qualifyingResult,
      ] = await Promise.allSettled([
        queryWithTimeout(
          supabase.from("lead_offers").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId),
          8000, // Reduced from 10000
          "total leads",
          false // Disable retry for faster failure
        ),
        queryWithTimeout(
          supabase.from("lead_offers").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "LEAD_READY"),
          8000,
          "lead ready count",
          false
        ),
        queryWithTimeout(
          supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "DELIVERED"),
          8000,
          "delivered count",
          false
        ),
        queryWithTimeout(
          supabase.from("tenant_credit_balance").select("current_balance").eq("tenant_id", activeTenantId).maybeSingle(),
          5000,
          "credit balance",
          false // Don't retry credit balance
        ),
        queryWithTimeout(
          supabase.from("offers").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "ACTIVE"),
          8000,
          "active offers",
          false
        ),
        queryWithTimeout(
          supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "ACTIVE"),
          8000,
          "team members",
          false
        ),
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
      ]);

      // Extract results with fallback to 0 on error
      const totalLeads = totalLeadsResult.status === "fulfilled" ? (totalLeadsResult.value.count || 0) : 0;
      const leadReadyCount = leadReadyResult.status === "fulfilled" ? (leadReadyResult.value.count || 0) : 0;
      const deliveredCount = deliveredResult.status === "fulfilled" ? (deliveredResult.value.count || 0) : 0;
      const creditData = creditResult.status === "fulfilled" ? creditResult.value.data : null;
      const activeOffers = offersResult.status === "fulfilled" ? (offersResult.value.count || 0) : 0;
      const teamMembers = membersResult.status === "fulfilled" ? (membersResult.value.count || 0) : 0;
      const contactedCount = contactedResult.status === "fulfilled" ? (contactedResult.value.count || 0) : 0;
      const qualifyingCount = qualifyingResult.status === "fulfilled" ? (qualifyingResult.value.count || 0) : 0;

      const total = totalLeads || 0;
      const delivered = deliveredCount || 0;

      setStats({
        totalLeads: total,
        leadReadyCount: leadReadyCount || 0,
        deliveredCount: delivered,
        conversionRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        creditBalance: (creditData as any)?.current_balance || 0,
        activeOffers: activeOffers || 0,
        teamMembers: teamMembers || 0,
        pipelineStats: {
          contacted: contactedCount || 0,
          qualifying: qualifyingCount || 0,
          leadReady: leadReadyCount || 0,
          delivered: delivered || 0,
        },
      });

      // Fetch recent leads (non-blocking, can fail silently)
      const { data: leadsData } = await queryWithTimeout(
        supabase
          .from("lead_offers")
          .select(`
            *,
            lead:leads(phone, full_name, email),
            offer:offers(name)
          `)
          .eq("tenant_id", activeTenantId)
          .order("created_at", { ascending: false })
          .limit(10),
        8000,
        "recent leads",
        false // Don't retry - this is non-critical
      );

      if (leadsData && Array.isArray(leadsData)) {
        setRecentLeads(
          leadsData.map((l: any) => ({
            ...l,
            lead: Array.isArray(l.lead) ? l.lead[0] : l.lead,
            offer: Array.isArray(l.offer) ? l.offer[0] : l.offer,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching dashboard:", err);
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, activeTenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, recentLeads, isLoading, error, refetch: fetchData };
}

// ============================================
// Hook: Portal Leads
// ============================================

interface UsePortalLeadsOptions {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function usePortalLeads(options: UsePortalLeadsOptions = {}) {
  const { activeTenantId } = useAuth();
  const { status, search, page = 1, pageSize = 20 } = options;
  const [leads, setLeads] = useState<LeadOffer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchLeads = useCallback(async () => {
    if (!activeTenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("lead_offers")
        .select(`
          *,
          lead:leads(id, phone, full_name, email, first_contact_at, last_contact_at),
          offer:offers!lead_offers_offer_id_fkey(id, name)
        `, { count: "exact" })
        .eq("tenant_id", activeTenantId);

      if (status) {
        query = query.eq("status", status);
      }

      if (search) {
        // This would need a proper full-text search setup
        query = query.or(`lead.phone.ilike.%${search}%,lead.full_name.ilike.%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error: queryError, count } = await queryWithTimeout(
        query,
        10000,
        "fetch portal leads"
      );

      if (queryError) throw queryError;

      setLeads(
        (Array.isArray(data) ? data : []).map((l: any) => ({
          ...l,
          lead: Array.isArray(l.lead) ? l.lead[0] : l.lead,
          offer: Array.isArray(l.offer) ? l.offer[0] : l.offer,
        }))
      );
      setTotal(count || 0);
    } catch (err) {
      console.error("Error fetching leads:", err);
      setError(err instanceof Error ? err.message : "Error al cargar leads");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, activeTenantId, status, search, page, pageSize]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return { leads, total, isLoading, error, refetch: fetchLeads };
}

// ============================================
// Hook: Portal Offers
// ============================================

export function usePortalOffers() {
  const { activeTenantId } = useAuth();
  const [offers, setOffers] = useState<(Offer & { lead_count?: number; variant_count?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchOffers() {
      if (!activeTenantId) {
        setIsLoading(false);
        return;
      }

      // Fetch offers (stats are optional and can be loaded lazily)
      const { data: offersData } = await queryWithTimeout(
        supabase
          .from("offers")
          .select("*")
          .eq("tenant_id", activeTenantId)
          .order("priority", { ascending: false }),
        8000, // Reduced timeout
        "fetch portal offers",
        false // Don't retry
      );

      if (offersData && Array.isArray(offersData)) {
        // Only fetch stats if we have a reasonable number of offers (avoid N+1 problem)
        if (offersData.length <= 10) {
          // Fetch stats for each offer in parallel with error handling
          const offersWithStats = await Promise.allSettled(
            offersData.map(async (offer: Offer) => {
              const [leadResult, variantResult] = await Promise.allSettled([
                queryWithTimeout(
                  supabase
                    .from("lead_offers")
                    .select("id", { count: "exact", head: true })
                    .eq("offer_id", offer.id),
                  5000,
                  `lead count for offer ${offer.id}`,
                  false // Don't retry
                ),
                queryWithTimeout(
                  supabase
                    .from("offer_variants")
                    .select("id", { count: "exact", head: true })
                    .eq("offer_id", offer.id),
                  5000,
                  `variant count for offer ${offer.id}`,
                  false // Don't retry
                ),
              ]);

              const leadCount = leadResult.status === "fulfilled" ? (leadResult.value.count || 0) : 0;
              const variantCount = variantResult.status === "fulfilled" ? (variantResult.value.count || 0) : 0;

              return {
                ...offer,
                lead_count: leadCount,
                variant_count: variantCount,
              };
            })
          );

          setOffers(
            offersWithStats
              .filter((result) => result.status === "fulfilled")
              .map((result) => (result as PromiseFulfilledResult<any>).value)
          );
        } else {
          // Too many offers - skip stats to avoid timeout
          setOffers(offersData.map((offer) => ({ ...offer, lead_count: 0, variant_count: 0 })));
        }
      } else {
        setOffers([]);
      }

      setIsLoading(false);
    }

    fetchOffers();
  }, [supabase, activeTenantId]);

  return { offers, isLoading };
}

// ============================================
// Hook: Portal Billing
// ============================================

export function usePortalBilling() {
  const { activeTenantId } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CreditLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchBilling() {
      if (!activeTenantId) {
        setIsLoading(false);
        return;
      }

      // Get balance
      const { data: balanceData } = await queryWithTimeout(
        supabase
          .from("tenant_credit_balance")
          .select("current_balance")
          .eq("tenant_id", activeTenantId)
          .maybeSingle(),
        5000,
        "credit balance",
        false // Don't retry balance queries
      );

      setBalance((balanceData as any)?.current_balance || 0);

      // Get transactions
      const { data: txData } = await queryWithTimeout(
        supabase
          .from("credit_ledger")
          .select("*")
          .eq("tenant_id", activeTenantId)
          .order("created_at", { ascending: false })
          .limit(50),
        10000,
        "credit ledger transactions"
      );

      setTransactions(Array.isArray(txData) ? txData : []);
      setIsLoading(false);
    }

    fetchBilling();
  }, [supabase, activeTenantId]);

  return { balance, transactions, isLoading };
}

// ============================================
// Hook: Portal Team
// ============================================

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  user: { id: string; email: string; full_name: string | null; avatar_url: string | null };
}

export function usePortalTeam() {
  const { activeTenantId } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchMembers = useCallback(async () => {
    if (!activeTenantId) {
      setIsLoading(false);
      return;
    }

    const { data } = await queryWithTimeout(
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
        .order("created_at"),
      10000,
      "fetch team members"
    );

    if (data && Array.isArray(data)) {
      setMembers(
        data.map((m: any) => ({
          ...m,
          user: Array.isArray(m.user) ? m.user[0] : m.user,
        }))
      );
    }
    setIsLoading(false);
  }, [supabase, activeTenantId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, isLoading, refetch: fetchMembers };
}

