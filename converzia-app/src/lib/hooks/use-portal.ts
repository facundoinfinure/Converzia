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

      // Validar y procesar datos con manejo de joins
      const processedLeads = (Array.isArray(data) ? data : [])
        .map((l: any) => {
          // Validar joins - manejar casos donde las relaciones pueden ser null o arrays vacíos
          const lead = Array.isArray(l.lead) ? (l.lead.length > 0 ? l.lead[0] : null) : l.lead;
          const offer = Array.isArray(l.offer) ? (l.offer.length > 0 ? l.offer[0] : null) : l.offer;
          
          return {
            ...l,
            lead: lead || null,
            offer: offer || null,
          };
        })
        .filter((l: any) => {
          // Filtrar leads que no tienen datos mínimos válidos
          // Para algunos casos, puede ser válido tener lead sin offer
          return l.lead !== null && l.lead !== undefined;
        });

      setLeads(processedLeads);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error fetching leads:", err);
      // Resetear arrays en caso de error
      setLeads([]);
      setTotal(0);
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
        try {
          // Usar offer_funnel_stats para obtener conteos consistentes con otras vistas
          // Esto asegura que usemos la misma fuente de datos que el Dashboard y Mis Leads
          const { data: funnelStatsData } = await queryWithTimeout(
            supabase
              .from("offer_funnel_stats")
              .select("offer_id, total_leads")
              .in("offer_id", offersData.map(o => o.id))
              .eq("tenant_id", activeTenantId),
            10000,
            "fetch offer funnel stats",
            false // Don't retry
          );

          // Crear mapa de stats por offer_id para acceso rápido
          const statsMap = new Map(
            (Array.isArray(funnelStatsData) ? funnelStatsData : []).map((s: any) => [
              s.offer_id,
              s.total_leads || 0
            ])
          );

          // Si hay pocos offers (<= 10), también cargar variant_count
          if (offersData.length <= 10) {
            const offersWithStats = await Promise.allSettled(
              offersData.map(async (offer: Offer) => {
                const variantResult = await Promise.allSettled([
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

                const variantCount = variantResult[0].status === "fulfilled" 
                  ? (variantResult[0].value.count || 0) 
                  : 0;

                return {
                  ...offer,
                  lead_count: statsMap.get(offer.id) || 0,
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
            // Para muchos offers, usar solo los stats de funnel (más eficiente)
            setOffers(
              offersData.map((offer) => ({
                ...offer,
                lead_count: statsMap.get(offer.id) || 0,
                variant_count: 0, // Puede cargarse después si es necesario
              }))
            );
          }
        } catch (error) {
          console.error("Error fetching offer stats:", error);
          // En caso de error, resetear array y usar valores por defecto
          setOffers(offersData.map((offer) => ({ ...offer, lead_count: 0, variant_count: 0 })));
        }
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
      // Resetear array en caso de error general
      setOffers([]);
    } finally {
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

