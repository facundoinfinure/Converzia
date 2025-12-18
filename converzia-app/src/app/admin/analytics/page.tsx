"use client";

import { useState } from "react";
import { Download, Calendar } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { LightCard, LightCardHeader, LightCardTitle, LightCardContent } from "@/components/ui/LightCard";
import { LightButton } from "@/components/ui/LightButton";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnalyticsCharts } from "@/components/admin/AnalyticsCharts";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAnalytics, TimeRange } from "@/lib/hooks/use-analytics";
import { formatCurrency } from "@/lib/utils";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const { data, isLoading } = useAnalytics(timeRange);

  const handleExport = () => {
    if (!data) return;

    const csvData = [
      ["Métrica", "Valor"],
      ["Total Leads", data.totalLeads],
      ["Leads Ready", data.totalReady],
      ["Entregados", data.totalDelivered],
      ["Tasa de Conversión", `${data.conversionRate}%`],
      ["Tiempo Promedio de Respuesta", `${data.avgResponseTime.toFixed(1)}min`],
    ];

    const csv = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <PageHeader title="Analytics" description="Métricas y reportes de la plataforma" />
        <LightCard>
          <div className="p-12 text-center text-gray-500">
            No hay datos disponibles para el período seleccionado.
          </div>
        </LightCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="Métricas y reportes de la plataforma"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Analytics" },
        ]}
        actions={
          <LightButton
            variant="secondary"
            onClick={handleExport}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Exportar Reporte
          </LightButton>
        }
      />

      {/* Time Range Selector */}
      <LightCard className="mb-6">
        <LightCardContent>
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <div className="flex items-center gap-2">
              {(["today", "7d", "30d", "90d"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    timeRange === range
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {range === "today"
                    ? "Hoy"
                    : range === "7d"
                    ? "7 días"
                    : range === "30d"
                    ? "30 días"
                    : "90 días"}
                </button>
              ))}
            </div>
          </div>
        </MercuryCardContent>
      </MercuryCard>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardCard
          title="Total Leads"
          value={data.totalLeads.toLocaleString()}
        />
        <DashboardCard
          title="Leads Ready"
          value={data.totalReady.toLocaleString()}
        />
        <DashboardCard
          title="Entregados"
          value={data.totalDelivered.toLocaleString()}
        />
        <DashboardCard
          title="Tasa de Conversión"
          value={`${data.conversionRate}%`}
        />
      </div>

      {/* Charts */}
      <AnalyticsCharts
        leadsByDay={data.leadsByDay}
        conversionByDay={data.conversionByDay}
        leadsByStatus={data.leadsByStatus}
        leadsByTenant={data.leadsByTenant}
      />

      {/* Additional Stats */}
      <LightCard className="mt-6">
        <LightCardHeader>
          <LightCardTitle>Métricas Adicionales</LightCardTitle>
        </LightCardHeader>
        <LightCardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tiempo Promedio de Respuesta</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.avgResponseTime.toFixed(1)}min
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Leads Ready Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.totalLeads
                  ? Math.round((data.totalReady / data.totalLeads) * 100)
                  : 0}
                %
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Delivery Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.totalReady
                  ? Math.round((data.totalDelivered / data.totalReady) * 100)
                  : 0}
                %
              </p>
            </div>
          </div>
        </MercuryCardContent>
      </MercuryCard>
    </PageContainer>
  );
}
