"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
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
    tenant: { id: string; name: string; vertical?: string };
  }>;
}

// ============================================
// Hook: Fetch Users
// ============================================

interface UseUsersOptions {
  search?: string;
  isAdmin?: boolean;
  vertical?: string; // Filter by tenant vertical
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
  const { search, isAdmin, vertical, page = 1, pageSize = 20 } = options;
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

      const { data, error: queryError, count } = await queryWithTimeout(
        query,
        10000,
        "fetch users"
      );

      if (queryError) throw queryError;

      // Fetch memberships for each user
      const usersWithMemberships = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (user: any) => {
          const { data: memberships } = await queryWithTimeout(
            supabase
              .from("tenant_members")
              .select(`
                id,
                tenant_id,
                role,
                status,
                tenant:tenants(id, name, vertical)
              `)
              .eq("user_id", user.id),
            5000,
            `memberships for user ${user.id}`
          );

          return {
            ...user,
            memberships: (Array.isArray(memberships) ? memberships : []).map((m: any) => ({
              ...m,
              tenant: Array.isArray(m.tenant) ? m.tenant[0] : m.tenant,
            })),
          };
        })
      );

      // Filter by vertical if specified
      let filteredUsers = usersWithMemberships;
      if (vertical) {
        if (vertical === "CONVERZIA") {
          // Show only Converzia admins (users with is_converzia_admin and no tenant memberships)
          filteredUsers = usersWithMemberships.filter((u) => u.is_converzia_admin);
        } else {
          // Show users that have at least one membership in a tenant with this vertical
          filteredUsers = usersWithMemberships.filter((u) =>
            u.memberships.some((m) => m.tenant?.vertical === vertical)
          );
        }
      }

      setUsers(filteredUsers);
      setTotal(vertical ? filteredUsers.length : (count || 0));
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, search, isAdmin, vertical, page, pageSize]);

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
      const { data, error: queryError, count } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .select(`
            id,
            user_id,
            tenant_id,
            role,
            status,
            created_at,
            user:user_profiles!tenant_members_user_id_fkey(id, email, full_name),
            tenant:tenants(id, name)
          `, { count: "exact" })
          .eq("status", "PENDING_APPROVAL")
          .order("created_at", { ascending: false }),
        10000,
        "fetch pending approvals"
      );

      if (queryError) {
        // Silently handle errors in sidebar - don't show errors for badge counts
        console.warn("Error fetching approvals (non-critical):", queryError);
        setApprovals([]);
        setTotal(0);
        return;
      }

      const formatted = (Array.isArray(data) ? data : []).map((a: any) => ({
        ...a,
        user: Array.isArray(a.user) ? a.user[0] : a.user,
        tenant: Array.isArray(a.tenant) ? a.tenant[0] : a.tenant,
      }));

      setApprovals(formatted);
      setTotal(count || 0);
    } catch (err) {
      // Silently handle errors in sidebar - don't show errors for badge counts
      console.warn("Error fetching approvals (non-critical):", err);
      setApprovals([]);
      setTotal(0);
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
      const { error } = await queryWithTimeout(
        supabase
          .from("user_profiles")
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq("id", id),
        30000,
        `update profile ${id}`
      );

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const setConverziaAdmin = async (id: string, isAdmin: boolean) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase
          .from("user_profiles")
          .update({ is_converzia_admin: isAdmin, updated_at: new Date().toISOString() })
          .eq("id", id),
        30000,
        `set admin status for user ${id}`
      );

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const approveMembership = async (membershipId: string) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .update({ status: "ACTIVE" })
          .eq("id", membershipId),
        30000,
        `approve membership ${membershipId}`
      );

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const rejectMembership = async (membershipId: string) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .update({ status: "REVOKED" })
          .eq("id", membershipId),
        30000,
        `reject membership ${membershipId}`
      );

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateMembershipRole = async (membershipId: string, role: string) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .update({ role })
          .eq("id", membershipId),
        30000,
        `update membership role ${membershipId}`
      );

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const suspendMembership = async (membershipId: string) => {
    setIsLoading(true);
    try {
      const { error } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .update({ status: "SUSPENDED" })
          .eq("id", membershipId),
        30000,
        `suspend membership ${membershipId}`
      );

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setIsLoading(true);
    try {
      // First remove all memberships
      const { error: memberError } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .delete()
          .eq("user_id", userId),
        30000,
        `delete memberships for user ${userId}`
      );

      if (memberError) throw memberError;

      // Then delete the user profile (auth user will remain for data integrity)
      const { error: profileError } = await queryWithTimeout(
        supabase
          .from("user_profiles")
          .delete()
          .eq("id", userId),
        30000,
        `delete user profile ${userId}`
      );

      if (profileError) throw profileError;
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
    deleteUser,
    isLoading,
  };
}









