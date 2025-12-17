"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tenant, TenantWithStats, TenantPricing } from "@/types";

// ============================================
// Hook: Fetch Tenants List
// ============================================

interface UseTenantsOptions {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

interface UseTenantsResult {
  tenants: TenantWithStats[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTenants(options: UseTenantsOptions = {}): UseTenantsResult {
  const { search, status, page = 1, pageSize = 20 } = options;
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("tenants")
        .select("*, tenant_pricing(*)", { count: "exact" });

      // Apply filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,contact_email.ilike.%${search}%`);
      }

      if (status) {
        query = query.eq("status", status);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Fetch additional stats for each tenant
      const tenantsWithStats: TenantWithStats[] = await Promise.all(
        (data || []).map(async (tenant: any) => {
          // Get credit balance
          const { data: balanceData } = await supabase
            .from("tenant_credit_balance")
            .select("current_balance")
            .eq("tenant_id", tenant.id)
            .single();

          // Get counts
          const { count: leadsCount } = await supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id);

          const { count: offersCount } = await supabase
            .from("offers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id);

          const { count: membersCount } = await supabase
            .from("tenant_members")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("status", "ACTIVE");

          return {
            ...tenant,
            credit_balance: balanceData?.current_balance || 0,
            _count: {
              leads: leadsCount || 0,
              offers: offersCount || 0,
              members: membersCount || 0,
            },
          };
        })
      );

      setTenants(tenantsWithStats);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error fetching tenants:", err);
      setError(err instanceof Error ? err.message : "Error al cargar tenants");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, search, status, page, pageSize]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  return { tenants, total, isLoading, error, refetch: fetchTenants };
}

// ============================================
// Hook: Fetch Single Tenant
// ============================================

interface UseTenantResult {
  tenant: TenantWithStats | null;
  pricing: TenantPricing | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTenant(id: string | null): UseTenantResult {
  const [tenant, setTenant] = useState<TenantWithStats | null>(null);
  const [pricing, setPricing] = useState<TenantPricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchTenant = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", id)
        .single();

      if (tenantError) throw tenantError;

      // Fetch pricing
      const { data: pricingData } = await supabase
        .from("tenant_pricing")
        .select("*")
        .eq("tenant_id", id)
        .single();

      // Get credit balance
      const { data: balanceData } = await supabase
        .from("tenant_credit_balance")
        .select("current_balance")
        .eq("tenant_id", id)
        .single();

      // Get counts
      const { count: leadsCount } = await supabase
        .from("lead_offers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", id);

      const { count: offersCount } = await supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", id);

      const { count: membersCount } = await supabase
        .from("tenant_members")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", id)
        .eq("status", "ACTIVE");

      setTenant({
        ...tenantData,
        credit_balance: balanceData?.current_balance || 0,
        _count: {
          leads: leadsCount || 0,
          offers: offersCount || 0,
          members: membersCount || 0,
        },
      });

      setPricing(pricingData as TenantPricing | null);
    } catch (err) {
      console.error("Error fetching tenant:", err);
      setError(err instanceof Error ? err.message : "Error al cargar tenant");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, id]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  return { tenant, pricing, isLoading, error, refetch: fetchTenant };
}

// ============================================
// Tenant Mutations
// ============================================

export function useTenantMutations() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const createTenant = async (data: {
    name: string;
    slug: string;
    contact_email?: string;
    contact_phone?: string;
    timezone?: string;
    default_score_threshold?: number;
    duplicate_window_days?: number;
  }) => {
    setIsLoading(true);
    try {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Create default pricing
      const { error: pricingError } = await supabase.from("tenant_pricing").insert({
        tenant_id: tenant.id,
        charge_model: "PER_LEAD",
        cost_per_lead: 10,
        packages: [
          { id: "starter", name: "Starter", credits: 50, price: 400 },
          { id: "growth", name: "Growth", credits: 100, price: 700, discount_pct: 12.5, is_popular: true },
          { id: "scale", name: "Scale", credits: 250, price: 1500, discount_pct: 25 },
        ],
      });

      if (pricingError) {
        console.error("Error creating default pricing:", pricingError);
        // Don't throw here - tenant is created, pricing can be added later
      }

      return tenant;
    } catch (error) {
      console.error("Error creating tenant:", error);
      throw error; // Re-throw to let component handle it
    } finally {
      setIsLoading(false);
    }
  };

  const updateTenant = async (id: string, data: Partial<Tenant>) => {
    setIsLoading(true);
    try {
      const { data: tenant, error } = await supabase
        .from("tenants")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return tenant;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTenantStatus = async (id: string, status: Tenant["status"]) => {
    setIsLoading(true);
    try {
      const updateData: Partial<Tenant> & { activated_at?: string } = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "ACTIVE") {
        updateData.activated_at = new Date().toISOString();
      }

      const { data: tenant, error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return tenant;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePricing = async (tenantId: string, data: Partial<TenantPricing>) => {
    setIsLoading(true);
    try {
      const { data: pricing, error } = await supabase
        .from("tenant_pricing")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;
      return pricing;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTenant = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Approve a pending tenant registration
   * Sets both tenant and all pending memberships to ACTIVE
   */
  const approveTenant = async (tenantId: string, approvedBy: string) => {
    setIsLoading(true);
    try {
      // Update tenant status to ACTIVE
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({
          status: "ACTIVE",
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);

      if (tenantError) throw tenantError;

      // Update all pending memberships to ACTIVE
      const { error: memberError } = await supabase
        .from("tenant_members")
        .update({
          status: "ACTIVE",
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("status", "PENDING_APPROVAL");

      if (memberError) throw memberError;

      // Create default pricing if not exists
      const { data: existingPricing } = await supabase
        .from("tenant_pricing")
        .select("id")
        .eq("tenant_id", tenantId)
        .single();

      if (!existingPricing) {
        await supabase.from("tenant_pricing").insert({
          tenant_id: tenantId,
          charge_model: "PER_LEAD",
          cost_per_lead: 10,
          packages: [
            { id: "starter", name: "Starter", credits: 50, price: 400 },
            { id: "growth", name: "Growth", credits: 100, price: 700, discount_pct: 12.5, is_popular: true },
            { id: "scale", name: "Scale", credits: 250, price: 1500, discount_pct: 25 },
          ],
        });
      }

      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reject a pending tenant registration
   */
  const rejectTenant = async (tenantId: string, reason: string, rejectedBy: string) => {
    setIsLoading(true);
    try {
      // Update tenant with rejection info
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({
          rejected_at: new Date().toISOString(),
          rejected_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);

      if (tenantError) throw tenantError;

      // Update memberships to REVOKED
      const { error: memberError } = await supabase
        .from("tenant_members")
        .update({
          status: "REVOKED",
          rejected_at: new Date().toISOString(),
          rejected_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("status", "PENDING_APPROVAL");

      if (memberError) throw memberError;

      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createTenant,
    updateTenant,
    updateTenantStatus,
    updatePricing,
    deleteTenant,
    approveTenant,
    rejectTenant,
    isLoading,
  };
}

