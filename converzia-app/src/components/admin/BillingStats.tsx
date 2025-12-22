"use client";

import { DashboardCard, HeroMetric } from "@/components/dashboard/DashboardCard";
import { SimpleChart } from "@/components/ui/SimpleChart";
import { CreditCard, TrendingUp, Users, Clock } from "lucide-react";

interface BillingStatsProps {
  totalRevenue: number;
  creditsSold: number;
  activeTenants: number;
  pendingPayments: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueTrend: Array<{ date: string; value: number }>;
}

export function BillingStats({
  totalRevenue,
  creditsSold,
  activeTenants,
  pendingPayments,
  revenueThisMonth,
  revenueLastMonth,
  revenueTrend,
}: BillingStatsProps) {
  const revenueChange = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Main Revenue Card */}
      <HeroMetric
        title="Ingresos Totales"
        value={`$${totalRevenue.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={<CreditCard className="h-6 w-6" />}
        accentColor="success"
        trend={
          revenueChange !== 0
            ? {
                value: Math.abs(revenueChange),
                label: "vs. mes anterior",
                direction: revenueChange >= 0 ? "up" : "down",
              }
            : undefined
        }
        chart={
          revenueTrend.length > 0 && (
            <SimpleChart
              data={revenueTrend}
              color="var(--success)"
              height={100}
              showGrid={false}
              showAxis={false}
            />
          )
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Créditos Vendidos"
          value={creditsSold.toLocaleString()}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="primary"
        />
        <DashboardCard
          title="Tenants Activos"
          value={activeTenants}
          icon={<Users className="h-5 w-5" />}
          iconColor="info"
        />
        <DashboardCard
          title="Pagos Pendientes"
          value={pendingPayments}
          icon={<Clock className="h-5 w-5" />}
          iconColor={pendingPayments > 0 ? "warning" : "success"}
        />
        <DashboardCard
          title="Ingresos Este Mes"
          value={`$${revenueThisMonth.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
          icon={<CreditCard className="h-5 w-5" />}
          iconColor="success"
          change={
            revenueChange !== 0
              ? {
                  value: Math.abs(Math.round(revenueChange)),
                  trend: revenueChange >= 0 ? "up" : "down",
                  label: "vs. mes anterior",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
