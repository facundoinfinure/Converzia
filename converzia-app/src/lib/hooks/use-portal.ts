"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
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
      // Fetch stats in parallel
      const [
        { count: totalLeads },
        { count: leadReadyCount },
        { count: deliveredCount },
        { data: creditData },
        { count: activeOffers },
        { count: teamMembers },
      ] = await Promise.all([
        supabase.from("lead_offers").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId),
        supabase.from("lead_offers").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "LEAD_READY"),
        supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "DELIVERED"),
        supabase.from("tenant_credit_balance").select("current_balance").eq("tenant_id", activeTenantId).maybeSingle(),
        supabase.from("offers").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "ACTIVE"),
        supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("tenant_id", activeTenantId).eq("status", "ACTIVE"),
      ]);

      const total = totalLeads || 0;
      const delivered = deliveredCount || 0;

      // Get pipeline stats (real data)
      const [
        { count: contactedCount },
        { count: qualifyingCount },
      ] = await Promise.all([
        supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", activeTenantId)
          .in("status", ["CONTACTED", "ENGAGED"]),
        supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", activeTenantId)
          .eq("status", "QUALIFYING"),
      ]);

      setStats({
        totalLeads: total,
        leadReadyCount: leadReadyCount || 0,
        deliveredCount: delivered,
        conversionRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        creditBalance: creditData?.current_balance || 0,
        activeOffers: activeOffers || 0,
        teamMembers: teamMembers || 0,
        pipelineStats: {
          contacted: contactedCount || 0,
          qualifying: qualifyingCount || 0,
          leadReady: leadReadyCount || 0,
          delivered: delivered || 0,
        },
      });

      // Fetch recent leads
      const { data: leadsData } = await supabase
        .from("lead_offers")
        .select(`
          *,
          lead:leads(phone, full_name, email),
          offer:offers(name)
        `)
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (leadsData) {
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
          offer:offers(id, name)
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

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setLeads(
        (data || []).map((l: any) => ({
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

      // Fetch offers with stats
      const { data: offersData } = await supabase
        .from("offers")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("priority", { ascending: false });

      if (offersData) {
        // Fetch stats for each offer
        const offersWithStats = await Promise.all(
          offersData.map(async (offer: Offer) => {
            const [
              { count: leadCount },
              { count: variantCount },
            ] = await Promise.all([
              supabase
                .from("lead_offers")
                .select("id", { count: "exact", head: true })
                .eq("offer_id", offer.id),
              supabase
                .from("offer_variants")
                .select("id", { count: "exact", head: true })
                .eq("offer_id", offer.id),
            ]);

            return {
              ...offer,
              lead_count: leadCount || 0,
              variant_count: variantCount || 0,
            };
          })
        );

        setOffers(offersWithStats);
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
      const { data: balanceData } = await supabase
        .from("tenant_credit_balance")
        .select("current_balance")
        .eq("tenant_id", activeTenantId)
        .maybeSingle();

      setBalance(balanceData?.current_balance || 0);

      // Get transactions
      const { data: txData } = await supabase
        .from("credit_ledger")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      setTransactions(txData || []);
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

    const { data } = await supabase
      .from("tenant_members")
      .select(`
        id,
        user_id,
        role,
        status,
        created_at,
        user:user_profiles(id, email, full_name, avatar_url)
      `)
      .eq("tenant_id", activeTenantId)
      .order("created_at");

    if (data) {
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

