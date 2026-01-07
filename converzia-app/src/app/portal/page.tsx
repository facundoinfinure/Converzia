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
  CheckCircle2,
  Plus,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { 
  DashboardCard, 
  HeroMetric, 
  AlertCard, 
  ActivityItem,
  QuickActionCard 
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
  const { stats, recentLeads, isLoadingStats, isLoadingLeads, error } = usePortalDashboard();
  const [leadsTrend, setLeadsTrend] = useState<Array<{ date: string; value: number }>>([]);
  const [isLoadingTrend, setIsLoadingTrend] = useState(false);

  // Fetch leads trend
  useEffect(() => {
    async function fetchTrend() {
      if (!activeTenantId) return;

      setIsLoadingTrend(true);
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
      setIsLoadingTrend(false);
    }

    fetchTrend();
  }, [activeTenantId]);

  const hasData = (stats?.totalLeads || 0) > 0 || (stats?.activeOffers || 0) > 0;

  return (
    <PageContainer>
      {/* Header - Simplified for mobile */}
      <PageHeader
        title={`Hola, ${activeTenant?.name.split(" ")[0] || "Portal"}`}
        description="Vista general de tu cuenta"
        compact
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
          className="mb-4 sm:mb-6"
        />
      )}

      {/* Hero Metric - Credits */}
      <HeroMetric
        title="Créditos Disponibles"
        value={stats?.creditBalance || 0}
        subtitle="créditos"
        icon={<Zap className="h-6 w-6" />}
        accentColor="primary"
        loading={isLoadingStats}
        chart={
          !isLoadingTrend && leadsTrend.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs sm:text-sm text-[var(--text-tertiary)] mb-2">
                Tendencia de leads (30 días)
              </p>
              <SimpleChart
                data={leadsTrend}
                color="var(--accent-primary)"
                height={80}
                showGrid={false}
                showAxis={false}
              />
            </div>
          ) : null
        }
        action={{
          label: "Recargar créditos",
          onClick: () => router.push("/portal/billing"),
        }}
        className="mb-4 sm:mb-6"
      />

      {/* Stats Grid - 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <DashboardCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          icon={<Users className="h-5 w-5" />}
          iconColor="info"
          size="sm"
          loading={isLoadingStats}
        />
        <DashboardCard
          title="Calificados"
          value={stats?.leadReadyCount || 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="success"
          size="sm"
          loading={isLoadingStats}
        />
        <DashboardCard
          title="Conversión"
          value={`${stats?.conversionRate || 0}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="primary"
          size="sm"
          loading={isLoadingStats}
        />
        <DashboardCard
          title="Proyectos"
          value={stats?.activeOffers || 0}
          icon={<Package className="h-5 w-5" />}
          iconColor="warning"
          size="sm"
          loading={isLoadingStats}
        />
      </div>

      {/* Two column layout - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Leads */}
        <Card className="animate-fadeInUp stagger-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle size="sm">Leads recientes</CardTitle>
              <Link href="/portal/offers">
                <Button 
                  size="sm" 
                  variant="ghost"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  <span className="hidden sm:inline">Ver todos</span>
                  <span className="sm:hidden">Ver</span>
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent noPadding>
            {isLoadingLeads ? (
              <div className="divide-y divide-[var(--border-primary)]">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 p-4 min-h-[64px]">
                    <Skeleton className="h-10 w-10 rounded-xl" variant="circular" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : recentLeads.length > 0 ? (
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
              <div className="py-10 sm:py-12 text-center">
                <Users className="h-10 w-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)] font-semibold">Sin leads todavía</p>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  Los leads aparecerán aquí cuando lleguen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Summary */}
        <Card className="animate-fadeInUp stagger-2">
          <CardHeader>
            <CardTitle size="sm">Pipeline de leads</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Skeleton className="h-3 w-3 rounded-full" variant="circular" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { 
                    label: "En Chat", 
                    count: stats?.pipelineStats?.contacted || 0, 
                    color: "bg-[var(--info)]",
                  },
                  { 
                    label: "Calificados", 
                    count: stats?.pipelineStats?.leadReady || 0, 
                    color: "bg-[var(--accent-primary)]",
                  },
                  { 
                    label: "Entregados", 
                    count: stats?.pipelineStats?.delivered || 0, 
                    color: "bg-[var(--success)]",
                  },
                ].map((stage, index) => {
                  const total = (stats?.totalLeads || 1);
                  const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0;
                  
                  return (
                    <div 
                      key={stage.label} 
                      className="space-y-2 animate-fadeInUp"
                      style={{ animationDelay: `${(index + 1) * 100}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full ${stage.color}`} />
                          <span className="text-xs sm:text-sm text-[var(--text-secondary)]">
                            {stage.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-sm font-bold text-[var(--text-primary)]">
                            {stage.count}
                          </span>
                          <span className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                            ({percentage}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${stage.color}`}
                          style={{ 
                            width: `${percentage}%`,
                            transitionDelay: `${(index + 1) * 100}ms`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
              <Button
                variant="ghost"
                size="md"
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
