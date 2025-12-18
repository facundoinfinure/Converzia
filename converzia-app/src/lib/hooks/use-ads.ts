"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdOfferMap, UnmappedAd } from "@/types";

// ============================================
// Hook: Fetch Unmapped Ads
// ============================================

interface UseUnmappedAdsResult {
  unmappedAds: UnmappedAd[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUnmappedAds(): UseUnmappedAdsResult {
  const [unmappedAds, setUnmappedAds] = useState<UnmappedAd[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchUnmappedAds = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get all lead_sources that don't have a mapping
      const { data: sources, error: sourcesError } = await supabase
        .from("lead_sources")
        .select("ad_id, campaign_id, form_id, created_at")
        .not("ad_id", "is", null);

      if (sourcesError) throw sourcesError;

      // Get existing mappings
      const { data: mappings } = await supabase
        .from("ad_offer_map")
        .select("ad_id");

      const mappedAdIds = new Set(mappings?.map((m: any) => m.ad_id) || []);

      // Group unmapped by ad_id
      const unmappedMap: Record<string, UnmappedAd> = {};

      (sources || []).forEach((source: any) => {
        if (!source.ad_id || mappedAdIds.has(source.ad_id)) return;

        if (!unmappedMap[source.ad_id]) {
          unmappedMap[source.ad_id] = {
            ad_id: source.ad_id,
            campaign_id: source.campaign_id,
            form_id: source.form_id,
            lead_count: 0,
            first_lead_at: source.created_at,
            last_lead_at: source.created_at,
          };
        }

        unmappedMap[source.ad_id].lead_count++;
        if (source.created_at < unmappedMap[source.ad_id].first_lead_at) {
          unmappedMap[source.ad_id].first_lead_at = source.created_at;
        }
        if (source.created_at > unmappedMap[source.ad_id].last_lead_at) {
          unmappedMap[source.ad_id].last_lead_at = source.created_at;
        }
      });

      const unmappedList = Object.values(unmappedMap).sort(
        (a, b) => b.lead_count - a.lead_count
      );

      setUnmappedAds(unmappedList);
      setTotal(unmappedList.length);
    } catch (err) {
      console.error("Error fetching unmapped ads:", err);
      setError(err instanceof Error ? err.message : "Error al cargar ads sin mapear");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUnmappedAds();
  }, [fetchUnmappedAds]);

  return { unmappedAds, total, isLoading, error, refetch: fetchUnmappedAds };
}

// ============================================
// Hook: Fetch Ad Mappings
// ============================================

interface UseAdMappingsOptions {
  tenantId?: string;
  offerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface AdMappingWithRelations extends AdOfferMap {
  tenant?: { id: string; name: string };
  offer?: { id: string; name: string };
}

interface UseAdMappingsResult {
  mappings: AdMappingWithRelations[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAdMappings(options: UseAdMappingsOptions = {}): UseAdMappingsResult {
  const { tenantId, offerId, search, page = 1, pageSize = 20 } = options;
  const [mappings, setMappings] = useState<AdMappingWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchMappings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("ad_offer_map")
        .select(`
          *,
          tenant:tenants(id, name),
          offer:offers(id, name)
        `, { count: "exact" });

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      if (offerId) {
        query = query.eq("offer_id", offerId);
      }

      if (search) {
        query = query.or(`ad_id.ilike.%${search}%,ad_name.ilike.%${search}%,campaign_name.ilike.%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      const formattedData = (data || []).map((m: any) => ({
        ...m,
        tenant: Array.isArray(m.tenant) ? m.tenant[0] : m.tenant,
        offer: Array.isArray(m.offer) ? m.offer[0] : m.offer,
      }));

      setMappings(formattedData);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error fetching ad mappings:", err);
      setError(err instanceof Error ? err.message : "Error al cargar mapeos");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, tenantId, offerId, search, page, pageSize]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  return { mappings, total, isLoading, error, refetch: fetchMappings };
}

// ============================================
// Ad Mapping Mutations
// ============================================

export function useAdMappingMutations() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const createMapping = async (data: {
    tenant_id: string;
    offer_id: string;
    ad_id: string;
    ad_name?: string;
    adset_id?: string;
    adset_name?: string;
    campaign_id?: string;
    campaign_name?: string;
    form_id?: string;
    notes?: string;
  }) => {
    setIsLoading(true);
    try {
      const { data: mapping, error } = await (supabase as any)
        .from("ad_offer_map")
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Update pending leads to TO_BE_CONTACTED
      const { data: sourceIds } = await (supabase as any)
        .from("lead_sources")
        .select("id")
        .eq("ad_id", data.ad_id);
      
      if (sourceIds && sourceIds.length > 0) {
        await (supabase as any)
          .from("lead_offers")
          .update({
            status: "TO_BE_CONTACTED",
            offer_id: data.offer_id,
            tenant_id: data.tenant_id,
            status_changed_at: new Date().toISOString(),
          })
          .eq("status", "PENDING_MAPPING")
          .in("lead_source_id", sourceIds.map((s: any) => s.id));
      }

      return mapping;
    } finally {
      setIsLoading(false);
    }
  };

  const updateMapping = async (id: string, data: Partial<AdOfferMap>) => {
    setIsLoading(true);
    try {
      const { data: mapping, error } = await (supabase as any)
        .from("ad_offer_map")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapping;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMapping = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await (supabase as any).from("ad_offer_map").delete().eq("id", id);
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const reprocessLeads = async (adId: string) => {
    setIsLoading(true);
    try {
      // Get the mapping for this ad
      const { data: mapping } = await (supabase as any)
        .from("ad_offer_map")
        .select("*")
        .eq("ad_id", adId)
        .single();

      if (!mapping) throw new Error("No mapping found for this ad");

      // Update all leads with this ad to TO_BE_CONTACTED
      const { data: sources } = await (supabase as any)
        .from("lead_sources")
        .select("id")
        .eq("ad_id", adId);

      if (sources && sources.length > 0) {
        await (supabase as any)
          .from("lead_offers")
          .update({
            status: "TO_BE_CONTACTED",
            offer_id: mapping.offer_id,
            tenant_id: mapping.tenant_id,
            status_changed_at: new Date().toISOString(),
          })
          .in("lead_source_id", sources.map((s: any) => s.id));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createMapping,
    updateMapping,
    deleteMapping,
    reprocessLeads,
    isLoading,
  };
}

// ============================================
// Hook: Fetch Offers for mapping (grouped by tenant)
// ============================================

interface TenantWithOffers {
  id: string;
  name: string;
  offers: Array<{ id: string; name: string }>;
}

export function useOffersForMapping() {
  const [tenantsWithOffers, setTenantsWithOffers] = useState<TenantWithOffers[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: tenants } = await (supabase as any)
        .from("tenants")
        .select("id, name")
        .eq("status", "ACTIVE")
        .order("name");

      if (tenants) {
        const results = await Promise.all(
          tenants.map(async (tenant: any) => {
            const { data: offers } = await (supabase as any)
              .from("offers")
              .select("id, name")
              .eq("tenant_id", tenant.id)
              .in("status", ["ACTIVE", "DRAFT"])
              .order("name");

            return {
              id: tenant.id,
              name: tenant.name,
              offers: offers || [],
            };
          })
        );

        setTenantsWithOffers(results.filter((t) => t.offers.length > 0));
      }

      setIsLoading(false);
    }

    fetchData();
  }, [supabase]);

  return { tenantsWithOffers, isLoading };
}


