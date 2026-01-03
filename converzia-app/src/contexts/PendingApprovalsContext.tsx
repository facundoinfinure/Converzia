"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

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

interface PendingApprovalsContextType {
  approvals: PendingApproval[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const PendingApprovalsContext = createContext<PendingApprovalsContextType | null>(null);

export function PendingApprovalsProvider({ children }: { children: ReactNode }) {
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
        15000,
        "fetch pending approvals"
      );

      if (queryError) {
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

  return (
    <PendingApprovalsContext.Provider
      value={{
        approvals,
        total,
        isLoading,
        error,
        refetch: fetchApprovals,
      }}
    >
      {children}
    </PendingApprovalsContext.Provider>
  );
}

export function usePendingApprovalsContext() {
  const context = useContext(PendingApprovalsContext);
  if (!context) {
    throw new Error("usePendingApprovalsContext must be used within PendingApprovalsProvider");
  }
  return context;
}

