"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useAuth } from "@/lib/auth/context";
import { useDashboard } from "@/lib/contexts/dashboard-context";
import type { LeadOffer, Offer, Delivery, CreditLedgerEntry, TenantMembership } from "@/types";

// ============================================
// Hook: Portal Dashboard Stats
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

export function usePortalDashboard() {
  // Use dashboard context instead of local state
  const {
    stats,
    recentLeads,
    isInitialLoading,
    isLoading,
    errors,
    refreshAll,
  } = useDashboard();

  // For backward compatibility, return isLoading as combined state
  const isLoadingCombined = isInitialLoading || isLoading.stats || isLoading.leads;
  const error = errors.stats || errors.leads || null;

  return {
    stats,
    recentLeads,
    isLoading: isLoadingCombined,
    error,
    refetch: refreshAll,
  };
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
  // Use dashboard context instead of local state
  const {
    billing,
    isInitialLoading,
    isLoading,
    errors,
    refreshBilling,
  } = useDashboard();

  // For backward compatibility
  const isLoadingCombined = isInitialLoading || isLoading.billing;
  const error = errors.billing;

  return {
    balance: billing.balance,
    transactions: billing.transactions,
    isLoading: isLoadingCombined,
    error,
    refetch: refreshBilling,
  };
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

    // Optimized query: filter by tenant_id and status ACTIVE first (uses composite index)
    // This order matches idx_tenant_members_tenant_active_created index
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
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: true }),
      15000, // Increased timeout slightly for join, but should be faster with index
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

