"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { Download, Calendar, BarChart3, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAnalytics, TimeRange } from "@/lib/hooks/use-analytics";

// Lazy load AnalyticsCharts component (heavy charts library)
const AnalyticsCharts = dynamic(
  () => import("@/components/admin/AnalyticsCharts").then((mod) => ({ default: mod.AnalyticsCharts })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false, // Charts don't need SSR
  }
);

function AnalyticsPageContent() {
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

  // No bloqueo completo - siempre mostrar estructura

  if (!data) {
    return (
      <PageContainer>
        <PageHeader title="Analytics" description="Métricas y reportes de la plataforma" />
        <Card>
          <EmptyState
            icon={<BarChart3 />}
            title="Sin datos disponibles"
            description="No hay datos disponibles para el período seleccionado."
            size="lg"
          />
        </Card>
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
          <Button
            variant="secondary"
            onClick={handleExport}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Exportar Reporte
          </Button>
        }
      />

      {/* Time Range Selector */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-[var(--text-tertiary)]" />
            <div className="flex items-center gap-2">
              {(["today", "7d", "30d", "90d"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    timeRange === range
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
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
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <DashboardCard
              key={i}
              title=""
              value=""
              loading={true}
            />
          ))
        ) : (
          <>
            <DashboardCard
              title="Total Leads"
              value={data.totalLeads.toLocaleString()}
              icon={<Users className="h-5 w-5" />}
              iconColor="primary"
            />
            <DashboardCard
              title="Leads Ready"
              value={data.totalReady.toLocaleString()}
              icon={<CheckCircle2 className="h-5 w-5" />}
              iconColor="success"
            />
            <DashboardCard
              title="Entregados"
              value={data.totalDelivered.toLocaleString()}
              icon={<TrendingUp className="h-5 w-5" />}
              iconColor="info"
            />
            <DashboardCard
              title="Tasa de Conversión"
              value={`${data.conversionRate}%`}
              icon={<BarChart3 className="h-5 w-5" />}
              iconColor="warning"
              change={
                data.conversionRate > 0
                  ? { value: data.conversionRate, trend: "up" as const }
                  : undefined
              }
            />
          </>
        )}
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : (
        <AnalyticsCharts
          leadsByDay={data.leadsByDay}
          conversionByDay={data.conversionByDay}
          leadsByStatus={data.leadsByStatus}
          leadsByTenant={data.leadsByTenant}
        />
      )}

      {/* Additional Stats */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Métricas Adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-[var(--bg-tertiary)] space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]">
                <p className="text-sm text-[var(--text-tertiary)] mb-1">Tiempo Promedio de Respuesta</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {data.avgResponseTime.toFixed(1)}min
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]">
                <p className="text-sm text-[var(--text-tertiary)] mb-1">Leads Ready Rate</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {data.totalLeads
                    ? Math.round((data.totalReady / data.totalLeads) * 100)
                    : 0}
                  %
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]">
                <p className="text-sm text-[var(--text-tertiary)] mb-1">Delivery Rate</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {data.totalReady
                    ? Math.round((data.totalDelivered / data.totalReady) * 100)
                    : 0}
                  %
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
