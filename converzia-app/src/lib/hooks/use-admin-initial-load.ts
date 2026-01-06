"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useAdmin } from "@/lib/contexts/admin-context";

// ============================================
// Hook: Admin Initial Load
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
        totalLeadsResult,
        activeTenantsResult,
        pendingApprovalsCountResult,
        unmappedLeadsResult,
        leadsTodayResult,
        leadReadyCountResult,
        creditDataResult,
        responseTimesResult,
        approvalsDataResult,
        billingStatsResult,
        billingOrdersResult,
      ] = await Promise.allSettled([
        // 1. Total leads count
        queryWithTimeout(
          supabase.from("lead_offers").select("id", { count: "exact", head: true }),
          10000,
          "lead_offers count",
          false
        ),

        // 2. Active tenants count
        queryWithTimeout(
          supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
          10000,
          "tenants count",
          false
        ),

        // 3. Pending approvals count
        queryWithTimeout(
          supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL"),
          10000,
          "tenant_members count",
          false
        ),

        // 4. Unmapped leads
        queryWithTimeout(
          supabase.from("lead_offers").select("id").eq("status", "PENDING_MAPPING"),
          10000,
          "unmapped leads",
          false
        ),

        // 5. Leads today
        (async () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return queryWithTimeout(
            supabase
              .from("lead_offers")
              .select("id", { count: "exact", head: true })
              .gte("created_at", today.toISOString()),
            10000,
            "today's leads",
            false
          );
        })(),

        // 6. Lead ready count
        queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .in("status", ["LEAD_READY", "SENT_TO_DEVELOPER"]),
          10000,
          "lead ready count",
          false
        ),

        // 7. Low credit tenants
        queryWithTimeout(
          supabase
            .from("tenant_credit_balance")
            .select("tenant_id, current_balance")
            .lt("current_balance", 10),
          10000,
          "low credit tenants",
          false
        ),

        // 8. Response times (for avg calculation)
        queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("created_at, first_response_at")
            .not("first_response_at", "is", null)
            .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(100),
          10000,
          "response times",
          false
        ),

        // 9. Pending approvals details
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

        // 10. Billing stats
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

        // 11. Recent billing orders
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

      // Process results and build stats
      const totalLeads = totalLeadsResult.status === "fulfilled" ? (totalLeadsResult.value.count || 0) : 0;
      const activeTenants = activeTenantsResult.status === "fulfilled" ? (activeTenantsResult.value.count || 0) : 0;
      const pendingApprovalsCount = pendingApprovalsCountResult.status === "fulfilled" ? (pendingApprovalsCountResult.value.count || 0) : 0;
      const unmappedLeads = unmappedLeadsResult.status === "fulfilled" ? (Array.isArray(unmappedLeadsResult.value.data) ? unmappedLeadsResult.value.data.length : 0) : 0;
      const leadsToday = leadsTodayResult.status === "fulfilled" ? (leadsTodayResult.value.count || 0) : 0;
      const leadReadyCount = leadReadyCountResult.status === "fulfilled" ? (leadReadyCountResult.value.count || 0) : 0;
      const creditData = creditDataResult.status === "fulfilled" ? (Array.isArray(creditDataResult.value.data) ? creditDataResult.value.data : []) : [];
      const responseTimes = responseTimesResult.status === "fulfilled" ? (Array.isArray(responseTimesResult.value.data) ? responseTimesResult.value.data : []) : [];

      // Calculate average response time
      let avgResponseTime = "N/A";
      if (responseTimes.length > 0) {
        const times = responseTimes
          .map((r: any) => {
            const created = new Date(r.created_at).getTime();
            const responded = new Date(r.first_response_at).getTime();
            return (responded - created) / 1000 / 60;
          })
          .filter((t: number) => t > 0 && t < 1440);

        if (times.length > 0) {
          const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length;
          avgResponseTime = `${avg.toFixed(1)}min`;
        }
      }

      // Build dashboard stats
      const stats = {
        totalLeads,
        leadsToday,
        activeTenants,
        leadReadyRate: totalLeads ? Math.round((leadReadyCount / totalLeads) * 100) : 0,
        avgResponseTime,
        pendingApprovals: pendingApprovalsCount,
        unmappedAds: unmappedLeads,
        lowCreditTenants: creditData.length,
      };

      updateStats(stats);

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

      // Load leads trend (non-blocking, can be loaded lazily)
      setLoading("stats", true);
      try {
        const daysAgo = 30;
        const trendData: Array<{ date: string; value: number }> = [];
        
        // Load trend data in batches to avoid too many queries
        const batchSize = 7; // Load 7 days at a time
        for (let batch = 0; batch < Math.ceil((daysAgo + 1) / batchSize); batch++) {
          const startDay = batch * batchSize;
          const endDay = Math.min(startDay + batchSize - 1, daysAgo);
          
          const datePromises = [];
          for (let i = startDay; i <= endDay; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (daysAgo - i));
            date.setHours(0, 0, 0, 0);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            datePromises.push(
              queryWithTimeout(
                supabase
                  .from("lead_offers")
                  .select("id", { count: "exact", head: true })
                  .gte("created_at", date.toISOString())
                  .lt("created_at", nextDay.toISOString()),
                5000,
                `trend data for day ${i}`,
                false
              )
            );
          }

          const batchResults = await Promise.allSettled(datePromises);
          batchResults.forEach((result, idx) => {
            const dayIndex = startDay + idx;
            const date = new Date();
            date.setDate(date.getDate() - (daysAgo - dayIndex));
            date.setHours(0, 0, 0, 0);

            const count = result.status === "fulfilled" ? (result.value.count || 0) : 0;
            trendData.push({
              date: date.toLocaleDateString("es-AR", { month: "short", day: "numeric" }),
              value: count,
            });
          });
        }

        updateStats((prev) => ({
          ...prev!,
          leadsTrend: trendData,
        }));
      } catch (err) {
        console.error("Error loading trend data:", err);
        // Non-critical, don't set error
      } finally {
        setLoading("stats", false);
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
