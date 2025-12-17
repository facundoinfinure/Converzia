"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, TenantMembership } from "@/types";

// ============================================
// User with memberships
// ============================================

interface UserWithMemberships extends UserProfile {
  memberships: Array<{
    id: string;
    tenant_id: string;
    role: string;
    status: string;
    tenant: { id: string; name: string };
  }>;
}

// ============================================
// Hook: Fetch Users
// ============================================

interface UseUsersOptions {
  search?: string;
  isAdmin?: boolean;
  page?: number;
  pageSize?: number;
}

interface UseUsersResult {
  users: UserWithMemberships[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUsers(options: UseUsersOptions = {}): UseUsersResult {
  const { search, isAdmin, page = 1, pageSize = 20 } = options;
  const [users, setUsers] = useState<UserWithMemberships[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("user_profiles")
        .select("*", { count: "exact" });

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      if (isAdmin !== undefined) {
        query = query.eq("is_converzia_admin", isAdmin);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Fetch memberships for each user
      const usersWithMemberships = await Promise.all(
        (data || []).map(async (user: any) => {
          const { data: memberships } = await supabase
            .from("tenant_members")
            .select(`
              id,
              tenant_id,
              role,
              status,
              tenant:tenants(id, name)
            `)
            .eq("user_id", user.id);

          return {
            ...user,
            memberships: (memberships || []).map((m: any) => ({
              ...m,
              tenant: Array.isArray(m.tenant) ? m.tenant[0] : m.tenant,
            })),
          };
        })
      );

      setUsers(usersWithMemberships);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, search, isAdmin, page, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, total, isLoading, error, refetch: fetchUsers };
}

// ============================================
// Hook: Pending Approvals
// ============================================

interface PendingApproval {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  status: string;
  created_at: string;
  user: { id: string; email: string; full_name: string | null };
  tenant: { id: string; name: string };
}

export function usePendingApprovals() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError, count } = await supabase
        .from("tenant_members")
        .select(`
          id,
          user_id,
          tenant_id,
          role,
          status,
          created_at,
          user:user_profiles(id, email, full_name),
          tenant:tenants(id, name)
        `, { count: "exact" })
        .eq("status", "PENDING_APPROVAL")
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      const formatted = (data || []).map((a: any) => ({
        ...a,
        user: Array.isArray(a.user) ? a.user[0] : a.user,
        tenant: Array.isArray(a.tenant) ? a.tenant[0] : a.tenant,
      }));

      setApprovals(formatted);
      setTotal(count || 0);
    } catch (err) {
      console.error("Error fetching approvals:", err);
      setError(err instanceof Error ? err.message : "Error al cargar aprobaciones");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  return { approvals, total, isLoading, error, refetch: fetchApprovals };
}

// ============================================
// User Mutations
// ============================================

export function useUserMutations() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const updateProfile = async (id: string, data: Partial<UserProfile>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const setConverziaAdmin = async (id: string, isAdmin: boolean) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_converzia_admin: isAdmin, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const approveMembership = async (membershipId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("tenant_members")
        .update({ status: "ACTIVE" })
        .eq("id", membershipId);

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const rejectMembership = async (membershipId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("tenant_members")
        .update({ status: "REVOKED" })
        .eq("id", membershipId);

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateMembershipRole = async (membershipId: string, role: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("tenant_members")
        .update({ role })
        .eq("id", membershipId);

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const suspendMembership = async (membershipId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("tenant_members")
        .update({ status: "SUSPENDED" })
        .eq("id", membershipId);

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateProfile,
    setConverziaAdmin,
    approveMembership,
    rejectMembership,
    updateMembershipRole,
    suspendMembership,
    isLoading,
  };
}

