/**
 * React Query hooks for audit logs
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";

// ============================================
// Types
// ============================================

export interface AuditLog {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Joined data
  user_email?: string | null;
  tenant_name?: string | null;
}

export interface AuditLogsFilters {
  tenant_id?: string;
  user_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// ============================================
// Fetch Audit Logs
// ============================================

async function fetchAuditLogs(params: {
  page: number;
  pageSize: number;
  filters?: AuditLogsFilters;
}): Promise<{ data: AuditLog[]; total: number }> {
  const { page, pageSize, filters = {} } = params;

  // Build query string
  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (filters.action) queryParams.append("action", filters.action);
  if (filters.entity_type) queryParams.append("entity_type", filters.entity_type);
  if (filters.tenant_id) queryParams.append("tenant_id", filters.tenant_id);
  if (filters.user_id) queryParams.append("user_id", filters.user_id);
  if (filters.entity_id) queryParams.append("entity_id", filters.entity_id);
  if (filters.date_from) queryParams.append("date_from", filters.date_from);
  if (filters.date_to) queryParams.append("date_to", filters.date_to);

  const response = await fetch(`/api/admin/audit?${queryParams.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch audit logs: ${response.statusText}`);
  }

  const result = await response.json();
  // Handle apiSuccess response format
  if (result.success && result.data) {
    return result.data;
  }
  return result;
}

// ============================================
// React Query Hook
// ============================================

export function useAuditLogs(
  params: {
    page: number;
    pageSize: number;
    filters?: AuditLogsFilters;
  },
  options?: Omit<UseQueryOptions<{ data: AuditLog[]; total: number }>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: ["audit_logs", params.page, params.pageSize, params.filters],
    queryFn: () => fetchAuditLogs(params),
    staleTime: 30000, // 30 seconds
    ...options,
  });
}
