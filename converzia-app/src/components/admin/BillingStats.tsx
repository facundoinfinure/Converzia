"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SimpleChart } from "@/components/ui/SimpleChart";
import { MercuryCard, MercuryCardHeader, MercuryCardTitle, MercuryCardContent } from "@/components/ui/MercuryCard";

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
      <MercuryCard className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <MercuryCardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <MercuryCardTitle className="text-gray-600 text-sm font-medium">
                Ingresos Totales
              </MercuryCardTitle>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-gray-900">
                  ${totalRevenue.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="text-sm">
                  <span className="text-gray-600">Este mes: </span>
                  <span className="font-medium text-gray-900">
                    ${revenueThisMonth.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {revenueChange !== 0 && (
                  <div className={`text-sm ${revenueChange > 0 ? "text-green-600" : "text-red-600"}`}>
                    {revenueChange > 0 ? "+" : ""}
                    {revenueChange.toFixed(1)}% vs. mes anterior
                  </div>
                )}
              </div>
            </div>
          </div>
        </MercuryCardHeader>
        <MercuryCardContent>
          {revenueTrend.length > 0 && (
            <div className="mt-4">
              <SimpleChart
                data={revenueTrend}
                color="#3b82f6"
                height={120}
                showGrid={false}
                showAxis={false}
              />
            </div>
          )}
        </MercuryCardContent>
      </MercuryCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Créditos Vendidos"
          value={creditsSold.toLocaleString()}
        />
        <DashboardCard
          title="Tenants Activos"
          value={activeTenants}
        />
        <DashboardCard
          title="Pagos Pendientes"
          value={pendingPayments}
        />
        <DashboardCard
          title="Ingresos Este Mes"
          value={`$${revenueThisMonth.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
          change={{
            value: Math.abs(revenueChange),
            trend: revenueChange >= 0 ? "up" : "down",
            label: "vs. mes anterior",
          }}
        />
      </div>
    </div>
  );
}
