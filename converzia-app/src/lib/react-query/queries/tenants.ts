/**
 * React Query hooks for Tenants
 * Reemplaza los custom hooks de use-tenants.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryWithTimeout } from '@/lib/supabase/query-with-timeout';
import { queryKeys, STALE_TIMES } from '../config';
import type { Tenant, TenantWithStats } from '@/types';

/**
 * Fetch tenants list with filters
 */
async function fetchTenants(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { search, status, page = 1, pageSize = 20 } = params;
  const supabase = createClient();

  let query = supabase
    .from('tenants')
    .select('*, tenant_pricing(*)', { count: 'exact' });

  // Apply filters
  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,contact_email.ilike.%${search}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await queryWithTimeout(
    query,
    5000,
    'fetch tenants'
  );

  if (error) throw error;

  // TODO: En producción, usar tenant_stats_mv (vista materializada)
  // para evitar N+1 queries
  return {
    tenants: data || [],
    total: count || 0,
  };
}

/**
 * Hook to fetch tenants list
 * Reemplaza useTenants de use-tenants.ts
 */
export function useTenants(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: queryKeys.tenants.list(params),
    queryFn: () => fetchTenants(params),
    staleTime: STALE_TIMES.FAST, // 1 minuto (datos que cambian frecuentemente)
    placeholderData: (prev) => prev, // Mantener datos anteriores mientras carga
  });
}

/**
 * Fetch single tenant with stats
 */
async function fetchTenant(id: string) {
  const supabase = createClient();

  // Fetch tenant
  const { data: tenant, error: tenantError } = await queryWithTimeout(
    supabase.from('tenants').select('*').eq('id', id).single(),
    5000,
    `fetch tenant ${id}`
  );

  if (tenantError) throw tenantError;
  if (!tenant) throw new Error('Tenant not found');

  // Fetch stats in parallel
  const [balanceData, leadsCount, offersCount, membersCount] = await Promise.all([
    queryWithTimeout(
      supabase
        .from('tenant_credit_balance')
        .select('current_balance')
        .eq('tenant_id', id)
        .maybeSingle(),
      3000,
      `credit balance for tenant ${id}`,
      false
    ),
    queryWithTimeout(
      supabase
        .from('lead_offers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
      3000,
      `leads count for tenant ${id}`
    ),
    queryWithTimeout(
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
      3000,
      `offers count for tenant ${id}`
    ),
    queryWithTimeout(
      supabase
        .from('tenant_members')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('status', 'ACTIVE'),
      3000,
      `members count for tenant ${id}`
    ),
  ]);

  return {
    ...tenant,
    credit_balance: balanceData.data?.current_balance || 0,
    _count: {
      leads: leadsCount.count || 0,
      offers: offersCount.count || 0,
      members: membersCount.count || 0,
    },
  } as TenantWithStats;
}

/**
 * Hook to fetch single tenant
 * Reemplaza useTenant de use-tenants.ts
 */
export function useTenant(id: string | null) {
  return useQuery({
    queryKey: queryKeys.tenants.detail(id!),
    queryFn: () => fetchTenant(id!),
    enabled: !!id, // Solo ejecutar si hay ID
    staleTime: STALE_TIMES.FAST,
  });
}

/**
 * Fetch tenant pricing
 */
async function fetchTenantPricing(tenantId: string) {
  const supabase = createClient();

  const { data, error } = await queryWithTimeout(
    supabase
      .from('tenant_pricing')
      .select('*')
      .eq('tenant_id', tenantId)
      .single(),
    5000,
    `fetch pricing for tenant ${tenantId}`
  );

  if (error) throw error;
  return data;
}

/**
 * Hook to fetch tenant pricing
 */
export function useTenantPricing(tenantId: string | null) {
  return useQuery({
    queryKey: queryKeys.tenants.pricing(tenantId!),
    queryFn: () => fetchTenantPricing(tenantId!),
    enabled: !!tenantId,
    staleTime: STALE_TIMES.SLOW, // 15 minutos (pricing no cambia mucho)
  });
}

/**
 * Create tenant mutation
 */
export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      contact_email?: string;
      contact_phone?: string;
    }) => {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear tenant');
      }

      return result.tenant;
    },
    onSuccess: () => {
      // Invalidar lista de tenants para refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.lists() });
    },
  });
}

/**
 * Update tenant mutation
 */
export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Tenant>;
    }) => {
      const supabase = createClient();

      const { data: tenant, error } = await queryWithTimeout(
        supabase
          .from('tenants')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single(),
        10000,
        `update tenant ${id}`
      );

      if (error) throw error;
      return tenant;
    },
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.lists(),
      });
    },
  });
}

/**
 * Update tenant status mutation
 */
export function useUpdateTenantStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Tenant['status'];
    }) => {
      const supabase = createClient();

      const updateData: Partial<Tenant> & { activated_at?: string } = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'ACTIVE') {
        updateData.activated_at = new Date().toISOString();
      }

      const { data: tenant, error } = await queryWithTimeout(
        supabase.from('tenants').update(updateData).eq('id', id).select().single(),
        10000,
        `update tenant status ${id}`
      );

      if (error) throw error;
      return tenant;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.lists(),
      });
    },
  });
}

/**
 * Approve tenant mutation
 */
export function useApproveTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      approvedBy,
    }: {
      tenantId: string;
      approvedBy: string;
    }) => {
      const supabase = createClient();

      // Update tenant status to ACTIVE
      const { error: tenantError } = await queryWithTimeout(
        supabase
          .from('tenants')
          .update({
            status: 'ACTIVE',
            activated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId),
        10000,
        `approve tenant ${tenantId}`
      );

      if (tenantError) throw tenantError;

      // Update memberships
      const { error: memberError } = await queryWithTimeout(
        supabase
          .from('tenant_members')
          .update({
            status: 'ACTIVE',
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('status', 'PENDING_APPROVAL'),
        10000,
        `approve memberships for tenant ${tenantId}`
      );

      if (memberError) throw memberError;

      // Grant trial credits
      await fetch(`/api/tenants/${tenantId}/trial-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 5 }),
      });

      return { success: true };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.detail(variables.tenantId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.lists(),
      });
    },
  });
}

/**
 * Delete tenant mutation
 */
export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();

      const { error } = await queryWithTimeout(
        supabase.from('tenants').delete().eq('id', id),
        10000,
        `delete tenant ${id}`
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.lists(),
      });
    },
  });
}
