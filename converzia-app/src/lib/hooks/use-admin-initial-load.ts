"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useAdmin } from "@/lib/contexts/admin-context";

// ============================================
// Types (from centralized stats service)
// ============================================

interface AdminDashboardStatsFromAPI {
  totalLeads: number;
  leadsToday: number;
  activeTenants: number;
  pendingApprovals: number;
  leadReadyRate: number;
  unmappedAds: number;
  lowCreditTenants: number;
  avgResponseTime: string;
  leadsTrend: Array<{ date: string; value: number }>;
}

// ============================================
// Hook: Admin Initial Load (uses centralized stats API)
// ============================================

export function useAdminInitialLoad() {
  const {
    isInitialLoading,
    setInitialLoading,
    setLoading,
    setError,
    updateStats,
    updateRecentActivity,
    updatePendingApprovals,
    updateBilling,
  } = useAdmin();

  const supabase = createClient();

  const loadAllData = useCallback(async () => {
    // Set initial loading state
    setInitialLoading(true);
    setError("stats", null);
    setError("activity", null);
    setError("approvals", null);
    setError("billing", null);

    try {
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setError("stats", `Error de autenticación: ${authError?.message || "Usuario no encontrado"}`);
        setInitialLoading(false);
        return;
      }

      // Load all data in parallel using Promise.allSettled for resilience
      const [
        statsResult,
        approvalsDataResult,
        billingStatsResult,
        billingOrdersResult,
      ] = await Promise.allSettled([
        // 1. Stats from centralized API
        fetch("/api/admin/stats").then(async (res) => {
          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || "Error fetching admin stats");
          }
          return res.json();
        }),

        // 2. Pending approvals details
        queryWithTimeout(
          supabase
            .from("tenant_members")
            .select(`
              id,
              tenant_id,
              user_id,
              created_at,
              tenant:tenants(name),
              user:user_profiles(email, full_name)
            `)
            .eq("status", "PENDING_APPROVAL")
            .order("created_at", { ascending: false })
            .limit(10),
          10000,
          "pending approvals",
          false
        ),

        // 3. Billing stats
        Promise.allSettled([
          // Total revenue
          supabase
            .from("billing_orders")
            .select("total, currency, created_at")
            .eq("status", "completed"),
          // Credits sold
          queryWithTimeout(
            supabase
              .from("credit_ledger")
              .select("amount")
              .eq("transaction_type", "CREDIT_PURCHASE"),
            10000,
            "get credit purchases",
            false
          ),
          // Active tenants
          queryWithTimeout(
            supabase
              .from("tenants")
              .select("id", { count: "exact", head: true })
              .eq("status", "ACTIVE"),
            10000,
            "get active tenants count",
            false
          ),
          // Pending payments
          queryWithTimeout(
            supabase
              .from("billing_orders")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending"),
            10000,
            "get pending payments count",
            false
          ),
        ]),

        // 4. Recent billing orders
        queryWithTimeout(
          supabase
            .from("billing_orders")
            .select(`
              id,
              tenant_id,
              total,
              currency,
              status,
              created_at,
              tenant:tenants(name)
            `)
            .order("created_at", { ascending: false })
            .limit(20),
          10000,
          "recent billing orders",
          false
        ),
      ]);

      // Process stats from API
      if (statsResult.status === "fulfilled" && statsResult.value.success) {
        const statsFromAPI = statsResult.value.data.dashboard as AdminDashboardStatsFromAPI;
        
        updateStats({
          totalLeads: statsFromAPI.totalLeads,
          leadsToday: statsFromAPI.leadsToday,
          activeTenants: statsFromAPI.activeTenants,
          leadReadyRate: statsFromAPI.leadReadyRate,
          avgResponseTime: statsFromAPI.avgResponseTime,
          pendingApprovals: statsFromAPI.pendingApprovals,
          unmappedAds: statsFromAPI.unmappedAds,
          lowCreditTenants: statsFromAPI.lowCreditTenants,
          leadsTrend: statsFromAPI.leadsTrend,
        });
      } else {
        console.error("Error loading admin stats:", statsResult);
        setError("stats", "Error al cargar estadísticas");
      }

      // Process pending approvals
      if (approvalsDataResult.status === "fulfilled" && approvalsDataResult.value.data) {
        const approvalsData = Array.isArray(approvalsDataResult.value.data) ? approvalsDataResult.value.data : [];
        const processedApprovals = approvalsData.map((a: any) => ({
          id: a.id,
          tenant_id: a.tenant_id,
          user_id: a.user_id,
          tenant_name: Array.isArray(a.tenant) ? a.tenant[0]?.name : a.tenant?.name || "Unknown",
          user_email: Array.isArray(a.user) ? a.user[0]?.email : a.user?.email || "",
          user_name: Array.isArray(a.user) ? a.user[0]?.full_name : a.user?.full_name || null,
          requested_at: a.created_at,
        }));

        updatePendingApprovals(processedApprovals);
      }

      // Process billing data
      if (billingStatsResult.status === "fulfilled") {
        const [revenueResult, creditsResult, tenantsResult, pendingResult] = billingStatsResult.value;

        const completedOrders = revenueResult.status === "fulfilled" ? (Array.isArray(revenueResult.value.data) ? revenueResult.value.data : []) : [];
        const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

        const creditPurchases = creditsResult.status === "fulfilled" ? (Array.isArray(creditsResult.value.data) ? creditsResult.value.data : []) : [];
        const creditsSold = creditPurchases.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

        const activeTenantsCount = tenantsResult.status === "fulfilled" ? (tenantsResult.value.count || 0) : 0;
        const pendingPayments = pendingResult.status === "fulfilled" ? (pendingResult.value.count || 0) : 0;

        updateBilling({
          stats: {
            totalRevenue,
            creditsSold,
            activeTenants: activeTenantsCount,
            pendingPayments,
          },
          orders: [],
        });
      }

      // Process billing orders
      if (billingOrdersResult.status === "fulfilled" && billingOrdersResult.value.data) {
        const ordersData = Array.isArray(billingOrdersResult.value.data) ? billingOrdersResult.value.data : [];
        const processedOrders = ordersData.map((o: any) => ({
          id: o.id,
          tenant_id: o.tenant_id,
          tenant_name: Array.isArray(o.tenant) ? o.tenant[0]?.name : o.tenant?.name || "Unknown",
          total: o.total,
          currency: o.currency,
          status: o.status,
          created_at: o.created_at,
        }));

        updateBilling((prev) => ({
          ...prev,
          orders: processedOrders,
        }));
      }

      // Load recent activity (non-blocking)
      setLoading("activity", true);
      try {
        const { data: recentLeads } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select(`
              id,
              status,
              created_at,
              tenant:tenants(name)
            `)
            .in("status", ["LEAD_READY", "PENDING_MAPPING", "ENGAGED"])
            .order("created_at", { ascending: false })
            .limit(10),
          10000,
          "recent activity",
          false
        );

        if (recentLeads && Array.isArray(recentLeads)) {
          const activity = recentLeads.map((l: any) => ({
            id: l.id,
            type: l.status === "LEAD_READY" ? "lead_ready" : l.status === "PENDING_MAPPING" ? "unmapped" : "conversation",
            description: l.status === "LEAD_READY" ? "Nuevo lead listo" : l.status === "PENDING_MAPPING" ? "Lead sin mapear" : "Conversación activa",
            timestamp: l.created_at,
            metadata: {
              tenant: Array.isArray(l.tenant) ? l.tenant[0]?.name : l.tenant?.name || "Sin tenant",
            },
          }));

          updateRecentActivity(activity);
        } else {
          updateRecentActivity([]);
        }
      } catch (err) {
        console.error("Error loading activity:", err);
        setError("activity", "Error al cargar actividad reciente");
      } finally {
        setLoading("activity", false);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
      setError("stats", "Error al cargar datos del dashboard");
    } finally {
      setInitialLoading(false);
    }
  }, [supabase, setInitialLoading, setLoading, setError, updateStats, updateRecentActivity, updatePendingApprovals, updateBilling]);

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    isInitialLoading,
    loadAllData,
  };
}
