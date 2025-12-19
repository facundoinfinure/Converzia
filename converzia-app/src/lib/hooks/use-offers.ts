"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
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

      const { data, error: queryError, count } = await queryWithTimeout(
        query,
        10000,
        "fetch offers"
      );

      if (queryError) throw queryError;

      // Fetch counts for each offer
      const offersWithCounts: OfferWithRelations[] = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (offer: any) => {
          const [
            { count: variantsCount },
            { count: unitsCount },
            { count: leadsCount },
            { count: adsCount },
          ] = await Promise.all([
            queryWithTimeout(
              supabase.from("offer_variants").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
              5000,
              `variants count for offer ${offer.id}`
            ),
            queryWithTimeout(
              supabase.from("units").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
              5000,
              `units count for offer ${offer.id}`
            ),
            queryWithTimeout(
              supabase.from("lead_offers").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
              5000,
              `leads count for offer ${offer.id}`
            ),
            queryWithTimeout(
              supabase.from("ad_offer_map").select("id", { count: "exact", head: true }).eq("offer_id", offer.id),
              5000,
              `ads count for offer ${offer.id}`
            ),
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
      const { data: offerData, error: offerError } = await queryWithTimeout(
        supabase
          .from("offers")
          .select(`
            *,
            tenant:tenants(id, name, slug)
          `)
          .eq("id", id)
          .single(),
        10000,
        `fetch offer ${id}`
      );

      if (offerError) throw offerError;
      if (!offerData || typeof offerData !== "object" || !("tenant_id" in offerData)) {
        throw new Error("Offer not found");
      }

      // Fetch variants, units, ad mappings, and counts in parallel
      const [
        { data: variantsData },
        { data: unitsData },
        { data: adsData },
        { count: leadsCount },
        { data: allTenantOffers },
      ] = await Promise.all([
        queryWithTimeout(
          supabase
            .from("offer_variants")
            .select("*")
            .eq("offer_id", id)
            .order("display_order"),
          10000,
          `variants for offer ${id}`
        ),
        queryWithTimeout(
          supabase
            .from("units")
            .select("*")
            .eq("offer_id", id)
            .order("unit_number"),
          10000,
          `units for offer ${id}`
        ),
        queryWithTimeout(
          supabase
            .from("ad_offer_map")
            .select("*")
            .eq("offer_id", id)
            .order("created_at", { ascending: false }),
          10000,
          `ad mappings for offer ${id}`
        ),
        queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .eq("offer_id", id),
          10000,
          `leads count for offer ${id}`
        ),
        queryWithTimeout(
          supabase
            .from("offers")
            .select("id, priority, created_at")
            .eq("tenant_id", offerData.tenant_id),
          10000,
          `all tenant offers for priority calculation`
        ),
      ]);

      let priorityPosition = 1;
      let totalOffers = 0;
      
      if (allTenantOffers && Array.isArray(allTenantOffers)) {
        // Sort by priority desc, then by created_at asc for deterministic order
        const sorted = [...allTenantOffers].sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        
        totalOffers = sorted.length;
        priorityPosition = sorted.findIndex((o) => o.id === id) + 1;
      }

      setOffer({
        ...offerData,
        tenant: Array.isArray((offerData as any).tenant) ? (offerData as any).tenant[0] : (offerData as any).tenant,
        _count: {
          variants: Array.isArray(variantsData) ? variantsData.length : 0,
          units: Array.isArray(unitsData) ? unitsData.length : 0,
          leads: leadsCount || 0,
          ads: Array.isArray(adsData) ? adsData.length : 0,
        },
        _priority: {
          position: priorityPosition,
          total: totalOffers,
        },
      } as any);
      setVariants(Array.isArray(variantsData) ? variantsData : []);
      setUnits(Array.isArray(unitsData) ? unitsData : []);
      setAdMappings(Array.isArray(adsData) ? adsData : []);
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
      console.log("createOffer called with data:", data);
      
      // Clean data - remove undefined values and ensure proper types
      const cleanData: any = {};
      Object.keys(data).forEach((key) => {
        const value = (data as any)[key];
        if (value !== undefined && value !== null && value !== "") {
          cleanData[key] = value;
        }
      });

      console.log("Cleaned data:", cleanData);

      // Ensure required fields
      if (!cleanData.tenant_id) {
        throw new Error("tenant_id es requerido");
      }
      if (!cleanData.name) {
        throw new Error("name es requerido");
      }
      if (!cleanData.slug) {
        throw new Error("slug es requerido");
      }

      console.log("Inserting offer into Supabase...");
      
      // Verify user is admin before attempting insert
      const authTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: La verificación de autenticación tardó más de 5 segundos")), 5000);
      });

      const { data: { user: currentUser }, error: authError } = await Promise.race([
        supabase.auth.getUser(),
        authTimeoutPromise,
      ]) as any;

      if (authError || !currentUser) {
        console.error("Auth error before insert:", authError);
        throw new Error("Error de autenticación. Por favor, recargá la página.");
      }

      // Check if user is Converzia admin
      const { data: profile, error: profileError } = await queryWithTimeout(
        supabase
          .from("user_profiles")
          .select("is_converzia_admin")
          .eq("id", currentUser.id)
          .single(),
        5000,
        "admin check",
        false // Don't retry admin check
      );

      if (profileError) {
        console.error("Error checking admin status:", profileError);
        throw new Error("Error al verificar permisos de administrador");
      }

      if (!profile || !(profile as any)?.is_converzia_admin) {
        console.error("User is not Converzia admin:", (currentUser as any)?.id);
        throw new Error("No tenés permisos de administrador para crear ofertas");
      }

      console.log("User verified as admin, proceeding with insert...");

      // Insert with timeout and retry
      const { data: offer, error } = await queryWithTimeout(
        supabase
          .from("offers")
          .insert(cleanData)
          .select()
          .single(),
        30000, // 30 second timeout for inserts
        "insert offer"
      );

      if (error) {
        console.error("Supabase error creating offer:", error);
        console.error("Error code:", error.code);
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Error hint:", error.hint);
        throw new Error(error.message || `Error al crear la oferta (${error.code || "unknown"})`);
      }

      if (!offer) {
        throw new Error("No se recibió respuesta del servidor");
      }

      console.log("Offer created successfully:", offer);
      return offer;
    } catch (error: any) {
      console.error("❌ Error in createOffer:", error);
      console.error("Error type:", typeof error);
      console.error("Error name:", error?.name);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error stack:", error?.stack);
      
      // Ensure we always throw a proper Error object
      const finalError = error instanceof Error 
        ? error 
        : new Error(error?.message || "Error desconocido al crear la oferta");
      
      throw finalError;
    } finally {
      setIsLoading(false);
      console.log("🏁 createOffer completed (finally block)");
    }
  };

  const updateOffer = async (id: string, data: Partial<Offer>) => {
    setIsLoading(true);
    try {
      const { data: offer, error } = await queryWithTimeout(
        supabase
          .from("offers")
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single(),
        30000,
        `update offer ${id}`
      );

      if (error) throw error;
      if (!offer) throw new Error("Failed to update offer");
      return offer;
    } finally {
      setIsLoading(false);
    }
  };

  const duplicateOffer = async (id: string) => {
    setIsLoading(true);
    try {
      // Fetch original offer
      const { data: original, error: fetchError } = await queryWithTimeout(
        supabase
          .from("offers")
          .select("*")
          .eq("id", id)
          .single(),
        10000,
        `fetch offer ${id} for duplication`
      );

      if (fetchError || !original || typeof original !== "object" || !("id" in original)) {
        throw fetchError || new Error("Oferta no encontrada");
      }

      // Create new offer without id and timestamps
      const { id: _, created_at, updated_at, ...offerData } = original as any;
      const newName = `${offerData.name} (Copia)`;

      const { data: newOffer, error: createError } = await queryWithTimeout(
        supabase
          .from("offers")
          .insert({
            ...offerData,
            name: newName,
            status: "DRAFT", // Start as draft
          })
          .select()
          .single(),
        30000,
        "duplicate offer"
      );

      if (createError || !newOffer || typeof newOffer !== "object" || !("id" in newOffer)) {
        throw createError || new Error("Failed to duplicate offer");
      }

      // Duplicate variants
      const { data: variants } = await queryWithTimeout(
        supabase
          .from("offer_variants")
          .select("*")
          .eq("offer_id", id),
        10000,
        `fetch variants for offer ${id}`
      );

      if (variants && Array.isArray(variants) && variants.length > 0) {
        const variantsToInsert = variants.map((variant: OfferVariant) => {
          const { id, offer_id, created_at, updated_at, ...rest } = variant;
          return {
            ...rest,
            offer_id: (newOffer as any).id,
          };
        });

        const { error: insertError } = await queryWithTimeout(
          supabase.from("offer_variants").insert(variantsToInsert),
          30000,
          "insert duplicated variants"
        );

        if (insertError) {
          console.error("Error duplicating variants:", insertError);
          // Don't throw - offer is already created
        }
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
      const { error } = await queryWithTimeout(
        supabase.from("offers").delete().eq("id", id),
        30000,
        `delete offer ${id}`
      );
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Variant operations
  const createVariant = async (data: Partial<OfferVariant>) => {
    setIsLoading(true);
    try {
      const { data: variant, error } = await queryWithTimeout(
        supabase
          .from("offer_variants")
          .insert(data)
          .select()
          .single(),
        30000,
        "create variant"
      );

      if (error) throw error;
      if (!variant) throw new Error("Failed to create variant");
      return variant;
    } finally {
      setIsLoading(false);
    }
  };

  const updateVariant = async (id: string, data: Partial<OfferVariant>) => {
    setIsLoading(true);
    try {
      const { data: variant, error } = await queryWithTimeout(
        supabase
          .from("offer_variants")
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single(),
        30000,
        `update variant ${id}`
      );

      if (error) throw error;
      if (!variant) throw new Error("Failed to update variant");
      return variant;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteVariant = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase.from("offer_variants").delete().eq("id", id),
        30000,
        `delete variant ${id}`
      );
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Unit operations
  const createUnit = async (data: Partial<Unit>) => {
    setIsLoading(true);
    try {
      const { data: unit, error } = await queryWithTimeout(
        supabase
          .from("units")
          .insert(data)
          .select()
          .single(),
        30000,
        "create unit"
      );

      if (error) throw error;
      if (!unit) throw new Error("Failed to create unit");
      return unit;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUnit = async (id: string, data: Partial<Unit>) => {
    setIsLoading(true);
    try {
      const { data: unit, error } = await queryWithTimeout(
        supabase
          .from("units")
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single(),
        30000,
        `update unit ${id}`
      );

      if (error) throw error;
      if (!unit) throw new Error("Failed to update unit");
      return unit;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUnit = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase.from("units").delete().eq("id", id),
        30000,
        `delete unit ${id}`
      );
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const bulkUpdateUnits = async (unitIds: string[], data: Partial<Unit>) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase
          .from("units")
          .update({ ...data, updated_at: new Date().toISOString() })
          .in("id", unitIds),
        30000,
        `bulk update ${unitIds.length} units`
      );

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

      if (data && Array.isArray(data)) {
        setOptions(data.map((t: any) => ({ value: t.id, label: t.name })));
      }
      setIsLoading(false);
    }

    fetchTenants();
  }, [supabase]);

  return { options, isLoading };
}

