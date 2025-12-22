"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  CreditCard,
  ArrowRight,
  Package,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { 
  DashboardCard, 
  HeroMetric, 
  AlertCard, 
  ActivityItem 
} from "@/components/dashboard/DashboardCard";
import { SimpleChart } from "@/components/ui/SimpleChart";
import { OnboardingChecklist } from "@/components/portal/OnboardingChecklist";
import { useAuth } from "@/lib/auth/context";
import { usePortalDashboard } from "@/lib/hooks/use-portal";
import { formatRelativeTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function PortalDashboard() {
  const router = useRouter();
  const { activeTenant, activeTenantId } = useAuth();
  const { stats, recentLeads, isLoading, error } = usePortalDashboard();
  const [leadsTrend, setLeadsTrend] = useState<Array<{ date: string; value: number }>>([]);

  // Fetch leads trend
  useEffect(() => {
    async function fetchTrend() {
      if (!activeTenantId) return;

      const supabase = createClient();
      const daysAgo = 30;
      const trendData: Array<{ date: string; value: number }> = [];

      for (let i = daysAgo; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { count } = await supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", activeTenantId)
          .gte("created_at", date.toISOString())
          .lt("created_at", nextDay.toISOString());

        trendData.push({
          date: date.toLocaleDateString("es-AR", { month: "short", day: "numeric" }),
          value: count || 0,
        });
      }

      setLeadsTrend(trendData);
    }

    fetchTrend();
  }, [activeTenantId]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  const hasData = (stats?.totalLeads || 0) > 0 || (stats?.activeOffers || 0) > 0;

  return (
    <PageContainer>
      <PageHeader
        title={`Bienvenido, ${activeTenant?.name || "Portal"}`}
        description="Vista general de tu cuenta"
      />

      {/* Onboarding checklist */}
      {activeTenant && <OnboardingChecklist tenantId={activeTenant.id} />}

      {/* Low credits alert */}
      {stats && stats.creditBalance < 10 && (
        <AlertCard
          type="warning"
          icon={<CreditCard className="h-5 w-5" />}
          title={`Créditos bajos: ${stats.creditBalance}`}
          description="Recargá para seguir recibiendo leads calificados."
          action={{
            label: "Recargar",
            onClick: () => router.push("/portal/billing"),
          }}
          className="mb-6"
        />
      )}

      {/* Hero Metric - Credits */}
      <HeroMetric
        title="Créditos Disponibles"
        value={stats?.creditBalance || 0}
        subtitle="créditos"
        icon={<Zap className="h-6 w-6" />}
        accentColor="primary"
        chart={
          leadsTrend.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-[var(--text-tertiary)] mb-2">
                Tendencia de leads (30 días)
              </p>
              <SimpleChart
                data={leadsTrend}
                color="var(--accent-primary)"
                height={100}
                showGrid={false}
                showAxis={false}
              />
            </div>
          )
        }
        action={{
          label: "Recargar créditos",
          onClick: () => router.push("/portal/billing"),
        }}
        className="mb-6"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          icon={<Users className="h-5 w-5" />}
          iconColor="info"
          action={{
            label: "Ver por proyecto",
            onClick: () => router.push("/portal/offers"),
          }}
        />
        <DashboardCard
          title="Leads Calificados"
          value={stats?.leadReadyCount || 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="success"
          action={{
            label: "Ver detalles",
            onClick: () => router.push("/portal/offers"),
          }}
        />
        <DashboardCard
          title="Tasa de Conversión"
          value={`${stats?.conversionRate || 0}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="primary"
          change={
            stats?.conversionRate && stats.conversionRate > 0
              ? { value: stats.conversionRate, trend: "up" as const }
              : undefined
          }
        />
        <DashboardCard
          title="Proyectos Activos"
          value={stats?.activeOffers || 0}
          icon={<Package className="h-5 w-5" />}
          iconColor="warning"
          action={{
            label: "Gestionar",
            onClick: () => router.push("/portal/offers"),
          }}
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Leads recientes</CardTitle>
              <Link href="/portal/offers">
                <Button 
                  size="sm" 
                  variant="ghost"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Ver todos
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent noPadding>
            {recentLeads.length > 0 ? (
              <div className="divide-y divide-[var(--border-primary)]">
                {recentLeads.slice(0, 5).map((lead) => (
                  <ActivityItem
                    key={lead.id}
                    icon={<Users className="h-4 w-4" />}
                    iconColor={
                      lead.status === "SENT_TO_DEVELOPER" ? "success" :
                      lead.status === "LEAD_READY" ? "primary" :
                      "neutral"
                    }
                    title={lead.lead?.full_name || lead.lead?.phone || "Lead"}
                    subtitle={lead.offer?.name || "Sin proyecto"}
                    timestamp={formatRelativeTime(lead.created_at)}
                    onClick={() => router.push("/portal/offers")}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Users className="h-10 w-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)] font-medium">Sin leads todavía</p>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  Los leads aparecerán aquí cuando lleguen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline de leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { 
                  label: "Contactados", 
                  count: stats?.pipelineStats?.contacted || 0, 
                  color: "bg-[var(--info)]",
                  bgColor: "bg-[var(--info-light)]" 
                },
                { 
                  label: "En calificación", 
                  count: stats?.pipelineStats?.qualifying || 0, 
                  color: "bg-[var(--accent-primary)]",
                  bgColor: "bg-[var(--accent-primary-light)]" 
                },
                { 
                  label: "Calificados", 
                  count: stats?.pipelineStats?.leadReady || 0, 
                  color: "bg-[var(--success)]",
                  bgColor: "bg-[var(--success-light)]" 
                },
                { 
                  label: "Entregados", 
                  count: stats?.pipelineStats?.delivered || 0, 
                  color: "bg-[var(--text-tertiary)]",
                  bgColor: "bg-[var(--bg-tertiary)]" 
                },
              ].map((stage) => {
                const total = (stats?.totalLeads || 1);
                const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0;
                
                return (
                  <div key={stage.label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                        <span className="text-sm text-[var(--text-secondary)]">
                          {stage.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {stage.count}
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/portal/offers")}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                className="w-full justify-between"
              >
                Ver por proyecto
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
