"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { useAdmin } from "@/lib/contexts/admin-context";

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
  // Use admin context instead of local state
  const {
    billing,
    isInitialLoading,
    isLoading,
    errors,
    refreshBilling,
  } = useAdmin();

  // For backward compatibility, map context data to expected types
  const isLoadingCombined = isInitialLoading || isLoading.billing;
  const error = errors.billing;

  // Map context billing stats to component type (add missing fields)
  const stats: BillingStats | null = billing.stats ? {
    totalRevenue: billing.stats.totalRevenue,
    creditsSold: billing.stats.creditsSold,
    activeTenants: billing.stats.activeTenants,
    pendingPayments: billing.stats.pendingPayments,
    revenueThisMonth: 0, // Can be calculated if needed
    revenueLastMonth: 0, // Can be calculated if needed
    revenueTrend: [], // Can be loaded if needed
  } : null;

  // Map context orders to component type
  const orders: BillingOrder[] = billing.orders.map((o) => ({
    id: o.id,
    order_number: o.id, // Use id as order number
    tenant_id: o.tenant_id,
    package_name: "Credit Package", // Default
    credits_purchased: 0, // Can be calculated if needed
    total: o.total,
    currency: o.currency,
    status: o.status,
    paid_at: o.status === "completed" ? o.created_at : null,
    created_at: o.created_at,
    tenant: { name: o.tenant_name },
  }));

  // Legacy fetchData for backward compatibility (calls refreshBilling)
  const fetchData = useCallback(async () => {
    await refreshBilling();

  }, [refreshBilling]);

  return {
    stats,
    orders,
    isLoading: isLoadingCombined,
    error,
    refetch: fetchData,
  };
}
