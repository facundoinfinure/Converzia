"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

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

export function useBillingAdmin() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Get total revenue (sum of completed orders)
      const { data: completedOrders } = await supabase
        .from("billing_orders")
        .select("total, currency, created_at")
        .eq("status", "completed");

      const totalRevenue = completedOrders?.reduce((sum: number, o) => sum + Number(o.total), 0) || 0;

      // Get credits sold
      const { data: creditPurchases } = await supabase
        .from("credit_ledger")
        .select("amount")
        .eq("transaction_type", "CREDIT_PURCHASE");

      const creditsSold = creditPurchases?.reduce((sum: number, c) => sum + c.amount, 0) || 0;

      // Get active tenants with billing
      const { count: activeTenants } = await supabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE");

      // Get pending payments
      const { count: pendingPayments } = await supabase
        .from("billing_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      // Get revenue this month
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const { data: thisMonthOrders } = await supabase
        .from("billing_orders")
        .select("total")
        .eq("status", "completed")
        .gte("paid_at", thisMonth.toISOString());

      const revenueThisMonth = thisMonthOrders?.reduce((sum: number, o) => sum + Number(o.total), 0) || 0;

      // Get revenue last month
      const lastMonth = new Date(thisMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthEnd = new Date(thisMonth);
      lastMonthEnd.setDate(0);

      const { data: lastMonthOrders } = await supabase
        .from("billing_orders")
        .select("total")
        .eq("status", "completed")
        .gte("paid_at", lastMonth.toISOString())
        .lt("paid_at", thisMonth.toISOString());

      const revenueLastMonth = lastMonthOrders?.reduce((sum: number, o) => sum + Number(o.total), 0) || 0;

      // Get revenue trend (last 30 days)
      const daysAgo = 30;
      const trendData: Array<{ date: string; value: number }> = [];

      for (let i = daysAgo; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { data: dayOrders } = await supabase
          .from("billing_orders")
          .select("total")
          .eq("status", "completed")
          .gte("paid_at", date.toISOString())
          .lt("paid_at", nextDay.toISOString());

        const dayRevenue = dayOrders?.reduce((sum: number, o) => sum + Number(o.total), 0) || 0;

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
      const { data: ordersData } = await supabase
        .from("billing_orders")
        .select(`
          *,
          tenant:tenants(name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (ordersData) {
        setOrders(
          ordersData.map((o: any) => ({
            ...o,
            tenant: Array.isArray(o.tenant) ? o.tenant[0] : o.tenant,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, orders, isLoading, refetch: fetchData };
}
