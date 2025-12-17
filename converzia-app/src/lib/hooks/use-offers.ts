"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Offer, OfferVariant, Unit, AdOfferMap } from "@/types";

// ============================================
// Offer with relations
// ============================================

interface OfferWithRelations extends Offer {
  tenant?: { id: string; name: string; slug: string };
  _count?: {
    variants: number;
    units: number;
    leads: number;
    ads: number;
  };
}

// ============================================
// Hook: Fetch Offers List
// ============================================

interface UseOffersOptions {
  tenantId?: string;
  search?: string;
  status?: string;
  offerType?: string;
  page?: number;
  pageSize?: number;
}

interface UseOffersResult {
  offers: OfferWithRelations[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOffers(options: UseOffersOptions = {}): UseOffersResult {
  const { tenantId, search, status, offerType, page = 1, pageSize = 20 } = options;
  const [offers, setOffers] = useState<OfferWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchOffers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("offers")
        .select(`
          *,
          tenant:tenants(id, name, slug)
        `, { count: "exact" });

      // Apply filters
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,city.ilike.%${search}%`);
      }

      if (status) {
        query = query.eq("status", status);
      }

      if (offerType) {
        query = query.eq("offer_type", offerType);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Fetch counts for each offer
      const offersWithCounts: OfferWithRelations[] = await Promise.all(
        (data || []).map(async (offer: any) => {
          const [
            { count: variantsCount },
            { count: unitsCount },
            { count: leadsCount },
            { count: adsCount },
          ] = await Promise.all([
            supabase.from("offer_variants").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
            supabase.from("units").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
            supabase.from("lead_offers").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
            supabase.from("ad_offer_map").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
          ]);

          return {
            ...offer,
            tenant: Array.isArray(offer.tenant) ? offer.tenant[0] : offer.tenant,
            _count: {
              variants: variantsCount || 0,
              units: unitsCount || 0,
              leads: leadsCount || 0,
              ads: adsCount || 0,
            },
          };
        })
      );

      setOffers(offersWithCounts);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error fetching offers:", err);
      setError(err instanceof Error ? err.message : "Error al cargar ofertas");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, tenantId, search, status, offerType, page, pageSize]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  return { offers, total, isLoading, error, refetch: fetchOffers };
}

// ============================================
// Hook: Fetch Single Offer
// ============================================

interface UseOfferResult {
  offer: OfferWithRelations | null;
  variants: OfferVariant[];
  units: Unit[];
  adMappings: AdOfferMap[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOffer(id: string | null): UseOfferResult {
  const [offer, setOffer] = useState<OfferWithRelations | null>(null);
  const [variants, setVariants] = useState<OfferVariant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [adMappings, setAdMappings] = useState<AdOfferMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchOffer = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch offer with tenant
      const { data: offerData, error: offerError } = await supabase
        .from("offers")
        .select(`
          *,
          tenant:tenants(id, name, slug)
        `)
        .eq("id", id)
        .single();

      if (offerError) throw offerError;

      // Fetch variants
      const { data: variantsData } = await supabase
        .from("offer_variants")
        .select("*")
        .eq("offer_id", id)
        .order("display_order");

      // Fetch units
      const { data: unitsData } = await supabase
        .from("units")
        .select("*")
        .eq("offer_id", id)
        .order("unit_number");

      // Fetch ad mappings
      const { data: adsData } = await supabase
        .from("ad_offer_map")
        .select("*")
        .eq("offer_id", id)
        .order("created_at", { ascending: false });

      // Get counts
      const { count: leadsCount } = await supabase
        .from("lead_offers")
        .select("id", { count: "exact", head: true })
        .eq("offer_id", id);

      setOffer({
        ...offerData,
        tenant: Array.isArray(offerData.tenant) ? offerData.tenant[0] : offerData.tenant,
        _count: {
          variants: variantsData?.length || 0,
          units: unitsData?.length || 0,
          leads: leadsCount || 0,
          ads: adsData?.length || 0,
        },
      });
      setVariants(variantsData || []);
      setUnits(unitsData || []);
      setAdMappings(adsData || []);
    } catch (err) {
      console.error("Error fetching offer:", err);
      setError(err instanceof Error ? err.message : "Error al cargar oferta");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, id]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  return { offer, variants, units, adMappings, isLoading, error, refetch: fetchOffer };
}

// ============================================
// Offer Mutations
// ============================================

export function useOfferMutations() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const createOffer = async (data: Partial<Offer>) => {
    setIsLoading(true);
    try {
      const { data: offer, error } = await supabase
        .from("offers")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return offer;
    } finally {
      setIsLoading(false);
    }
  };

  const updateOffer = async (id: string, data: Partial<Offer>) => {
    setIsLoading(true);
    try {
      const { data: offer, error } = await supabase
        .from("offers")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return offer;
    } finally {
      setIsLoading(false);
    }
  };

  const duplicateOffer = async (id: string) => {
    setIsLoading(true);
    try {
      // Fetch original offer
      const { data: original, error: fetchError } = await supabase
        .from("offers")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !original) throw fetchError || new Error("Oferta no encontrada");

      // Create new offer without id and timestamps
      const { id: _, created_at, updated_at, ...offerData } = original;
      const newName = `${offerData.name} (Copia)`;

      const { data: newOffer, error: createError } = await supabase
        .from("offers")
        .insert({
          ...offerData,
          name: newName,
          status: "DRAFT", // Start as draft
        })
        .select()
        .single();

      if (createError || !newOffer) throw createError;

      // Duplicate variants
      const { data: variants } = await supabase
        .from("offer_variants")
        .select("*")
        .eq("offer_id", id);

      if (variants && variants.length > 0) {
        const variantsToInsert = variants.map(({ id: _, offer_id: _, created_at: _, updated_at: _, ...variant }) => ({
          ...variant,
          offer_id: newOffer.id,
        }));

        await supabase.from("offer_variants").insert(variantsToInsert);
      }

      return newOffer;
    } catch (error) {
      console.error("Error duplicating offer:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteOffer = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("offers").delete().eq("id", id);
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Variant operations
  const createVariant = async (data: Partial<OfferVariant>) => {
    setIsLoading(true);
    try {
      const { data: variant, error } = await supabase
        .from("offer_variants")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return variant;
    } finally {
      setIsLoading(false);
    }
  };

  const updateVariant = async (id: string, data: Partial<OfferVariant>) => {
    setIsLoading(true);
    try {
      const { data: variant, error } = await supabase
        .from("offer_variants")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return variant;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteVariant = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("offer_variants").delete().eq("id", id);
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Unit operations
  const createUnit = async (data: Partial<Unit>) => {
    setIsLoading(true);
    try {
      const { data: unit, error } = await supabase
        .from("units")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return unit;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUnit = async (id: string, data: Partial<Unit>) => {
    setIsLoading(true);
    try {
      const { data: unit, error } = await supabase
        .from("units")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return unit;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUnit = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const bulkUpdateUnits = async (unitIds: string[], data: Partial<Unit>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("units")
        .update({ ...data, updated_at: new Date().toISOString() })
        .in("id", unitIds);

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createOffer,
    updateOffer,
    duplicateOffer,
    deleteOffer,
    createVariant,
    updateVariant,
    deleteVariant,
    createUnit,
    updateUnit,
    deleteUnit,
    bulkUpdateUnits,
    isLoading,
  };
}

// ============================================
// Hook: Fetch Tenants (for select)
// ============================================

export function useTenantOptions() {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchTenants() {
      const { data } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("status", "ACTIVE")
        .order("name");

      if (data) {
        setOptions(data.map((t: any) => ({ value: t.id, label: t.name })));
      }
      setIsLoading(false);
    }

    fetchTenants();
  }, [supabase]);

  return { options, isLoading };
}

