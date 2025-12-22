"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

interface BillingStats {
  totalRevenue: number;
  creditsSold: number;
  activeTenants: number;
  pendingPayments: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueTrend: Array<{ date: string; value: number }>;
}

interface BillingOrder {
  id: string;
  order_number: string;
  tenant_id: string;
  package_name: string;
  credits_purchased: number;
  total: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  tenant?: { name: string };
}

interface OrderTotal {
  total: number;
  currency?: string;
  created_at?: string;
}

interface CreditPurchase {
  amount: number;
}

export function useBillingAdmin() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get total revenue (sum of completed orders)
      const { data: completedOrders, error: completedError } = await supabase
        .from("billing_orders")
        .select("total, currency, created_at")
        .eq("status", "completed");

      if (completedError) {
        console.error("Error fetching completed orders:", completedError);
      }

      const totalRevenue = (completedOrders as any[] || []).reduce((sum: number, o: OrderTotal) => sum + Number(o.total), 0) || 0;

      // Get credits sold
      const { data: creditPurchases, error: creditError } = await queryWithTimeout(
        supabase
          .from("credit_ledger")
          .select("amount")
          .eq("transaction_type", "CREDIT_PURCHASE"),
        10000,
        "get credit purchases"
      );

      if (creditError) {
        console.error("Error fetching credit purchases:", creditError);
      }

      const creditsSold = (creditPurchases as any[] || []).reduce((sum: number, c: CreditPurchase) => sum + c.amount, 0) || 0;

      // Get active tenants with billing
      const { count: activeTenants, error: tenantsError } = await queryWithTimeout(
        supabase
          .from("tenants")
          .select("id", { count: "exact", head: true })
          .eq("status", "ACTIVE"),
        10000,
        "get active tenants count"
      );

      if (tenantsError) {
        console.error("Error fetching active tenants:", tenantsError);
      }

      // Get pending payments
      const { count: pendingPayments, error: pendingError } = await queryWithTimeout(
        supabase
          .from("billing_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        10000,
        "get pending payments count"
      );

      if (pendingError) {
        console.error("Error fetching pending payments:", pendingError);
      }

      // Get revenue this month
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const { data: thisMonthOrders, error: thisMonthError } = await queryWithTimeout(
        supabase
          .from("billing_orders")
          .select("total")
          .eq("status", "completed")
          .gte("paid_at", thisMonth.toISOString()),
        10000,
        "get this month orders"
      );

      if (thisMonthError) {
        console.error("Error fetching this month orders:", thisMonthError);
      }

      const revenueThisMonth = (thisMonthOrders as any[] || []).reduce((sum: number, o: OrderTotal) => sum + Number(o.total), 0) || 0;

      // Get revenue last month
      const lastMonth = new Date(thisMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthEnd = new Date(thisMonth);
      lastMonthEnd.setDate(0);

      const { data: lastMonthOrders, error: lastMonthError } = await queryWithTimeout(
        supabase
          .from("billing_orders")
          .select("total")
          .eq("status", "completed")
          .gte("paid_at", lastMonth.toISOString())
          .lt("paid_at", thisMonth.toISOString()),
        10000,
        "get last month orders"
      );

      if (lastMonthError) {
        console.error("Error fetching last month orders:", lastMonthError);
      }

      const revenueLastMonth = (lastMonthOrders as any[] || []).reduce((sum: number, o: OrderTotal) => sum + Number(o.total), 0) || 0;

      // Get revenue trend (last 30 days)
      const daysAgo = 30;
      const trendData: Array<{ date: string; value: number }> = [];

      for (let i = daysAgo; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { data: dayOrders, error: dayError } = await queryWithTimeout(
          supabase
            .from("billing_orders")
            .select("total")
            .eq("status", "completed")
            .gte("paid_at", date.toISOString())
            .lt("paid_at", nextDay.toISOString()),
          10000,
          `get orders for ${date.toISOString().split("T")[0]}`
        );

        if (dayError) {
          console.error("Error fetching day orders:", dayError);
        }

        const dayRevenue = (dayOrders as any[] || []).reduce((sum: number, o: OrderTotal) => sum + Number(o.total), 0) || 0;

        trendData.push({
          date: date.toLocaleDateString("es-AR", { month: "short", day: "numeric" }),
          value: dayRevenue,
        });
      }

      setStats({
        totalRevenue,
        creditsSold,
        activeTenants: activeTenants || 0,
        pendingPayments: pendingPayments || 0,
        revenueThisMonth,
        revenueLastMonth,
        revenueTrend: trendData,
      });

      // Fetch recent orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("billing_orders")
        .select(`
          *,
          tenant:tenants(name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        setError(ordersError.message || "Error al cargar órdenes");
      } else if (ordersData) {
        setOrders(
          ordersData.map((o: any) => ({
            ...o,
            tenant: Array.isArray(o.tenant) ? o.tenant[0] : o.tenant,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
      setError(error instanceof Error ? error.message : "Error al cargar datos de facturación");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, orders, isLoading, error, refetch: fetchData };
}
