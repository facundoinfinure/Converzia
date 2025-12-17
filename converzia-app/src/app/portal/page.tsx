"use client";

// Force dynamic rendering
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  TrendingUp,
  CreditCard,
  Package,
  ArrowRight,
  CheckCircle,
  Clock,
  MessageSquare,
  Plus,
  Link2,
  Settings,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { MercuryCard, MercuryCardHeader, MercuryCardTitle, MercuryCardContent, MercuryCardFooter } from "@/components/ui/MercuryCard";
import { MercuryButton } from "@/components/ui/MercuryButton";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SimpleChart } from "@/components/ui/SimpleChart";
import { Badge, LeadStatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { OnboardingChecklist } from "@/components/portal/OnboardingChecklist";
import { useAuth } from "@/lib/auth/context";
import { usePortalDashboard } from "@/lib/hooks/use-portal";
import { formatRelativeTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function PortalDashboard() {
  const router = useRouter();
  const { activeTenant, activeTenantId } = useAuth();
  const { stats, recentLeads, isLoading, error } = usePortalDashboard();
  const [leadsTrend, setLeadsTrend] = useState<Array<{ date: string; value: number }>>([]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Fetch leads trend
  useEffect(() => {
    async function fetchTrend() {
      if (!activeTenantId) return;

      const supabase = createClient();
      const daysAgo = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
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
  }, [activeTenantId, timeRange]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  // Quick actions for portal
  const quickActions = [
    {
      label: "Recargar Créditos",
      icon: <CreditCard className="h-4 w-4" />,
      onClick: () => router.push("/portal/billing"),
      variant: "primary" as const,
    },
    {
      label: "Ver Leads Ready",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: () => router.push("/portal/leads?status=LEAD_READY"),
      variant: "secondary" as const,
      disabled: (stats?.leadReadyCount || 0) === 0,
    },
    {
      label: "Nueva Oferta",
      icon: <Plus className="h-4 w-4" />,
      onClick: () => router.push("/admin/offers/new"),
      variant: "secondary" as const,
    },
    {
      label: "Configurar Integración",
      icon: <Link2 className="h-4 w-4" />,
      onClick: () => router.push("/portal/integrations"),
      variant: "secondary" as const,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={`Bienvenido, ${activeTenant?.name || "Portal"}`}
        description="Vista general de tu cuenta"
      />

      {/* Onboarding checklist */}
      {activeTenant && <OnboardingChecklist tenantId={activeTenant.id} />}

      {/* Quick Actions - Estilo Mercury */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-medium text-gray-600 mb-1">Bienvenido</h2>
          <p className="text-2xl font-semibold text-gray-900">Acciones rápidas</p>
        </div>
        <Link href="#" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          Personalizar
          <Settings className="h-4 w-4" />
        </Link>
      </div>
      <QuickActions actions={quickActions} />

      {/* Main Metric Card - Créditos (Estilo Mercury) */}
      <MercuryCard className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <MercuryCardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <MercuryCardTitle className="text-gray-600 text-sm font-medium">
                Créditos Disponibles
              </MercuryCardTitle>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-gray-900">
                  {stats?.creditBalance || 0}
                </span>
                <span className="text-gray-600">créditos</span>
              </div>
              {stats && stats.creditBalance < 10 && (
                <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Créditos bajos - recargá para seguir recibiendo leads
                </p>
              )}
            </div>
          </div>
        </MercuryCardHeader>
        <MercuryCardContent>
          {leadsTrend.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Tendencia de leads</span>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-2 py-1"
                >
                  <option value="7d">7 días</option>
                  <option value="30d">30 días</option>
                  <option value="90d">90 días</option>
                </select>
              </div>
              <SimpleChart
                data={leadsTrend}
                color="#3b82f6"
                height={120}
                showGrid={false}
                showAxis={false}
              />
            </div>
          )}
        </MercuryCardContent>
        <MercuryCardFooter>
          <MercuryButton variant="primary" size="sm" onClick={() => router.push("/portal/billing")}>
            Recargar créditos
          </MercuryButton>
        </MercuryCardFooter>
      </MercuryCard>

      {/* Stats Grid - Estilo Mercury */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          action={{
            label: "Ver todos",
            onClick: () => router.push("/portal/leads"),
          }}
        />
        <DashboardCard
          title="Leads Ready"
          value={stats?.leadReadyCount || 0}
          action={{
            label: "Ver",
            onClick: () => router.push("/portal/leads?status=LEAD_READY"),
          }}
        />
        <DashboardCard
          title="Tasa de conversión"
          value={`${stats?.conversionRate || 0}%`}
        />
        <DashboardCard
          title="Ofertas Activas"
          value={stats?.activeOffers || 0}
          action={{
            label: "Ver",
            onClick: () => router.push("/portal/offers"),
          }}
        />
      </div>

      {/* Cards Informativos - Estilo Mercury */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <MercuryCard>
          <MercuryCardHeader>
            <div className="flex items-center justify-between w-full">
              <MercuryCardTitle>Leads recientes</MercuryCardTitle>
              <Link href="/portal/leads">
                <MercuryButton size="sm" variant="text" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Ver todos
                </MercuryButton>
              </Link>
            </div>
          </MercuryCardHeader>
          <MercuryCardContent className="p-0">
            {recentLeads.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push("/portal/leads")}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {lead.lead?.full_name || lead.lead?.phone || "Lead"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {lead.offer?.name || "Sin oferta"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <LeadStatusBadge status={lead.status} />
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(lead.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No hay leads todavía. Cuando lleguen leads de tus campañas, aparecerán aquí.
              </div>
            )}
          </MercuryCardContent>
        </MercuryCard>

        {/* Pipeline Summary - Con datos reales */}
        <MercuryCard>
          <MercuryCardHeader>
            <MercuryCardTitle>Pipeline de leads</MercuryCardTitle>
          </MercuryCardHeader>
          <MercuryCardContent>
            <div className="space-y-4">
              {[
                { label: "Contactados", count: stats?.pipelineStats?.contacted || 0, color: "bg-blue-500" },
                { label: "En calificación", count: stats?.pipelineStats?.qualifying || 0, color: "bg-purple-500" },
                { label: "Lead Ready", count: stats?.pipelineStats?.leadReady || 0, color: "bg-emerald-500" },
                { label: "Entregados", count: stats?.pipelineStats?.delivered || 0, color: "bg-gray-500" },
              ].map((stage) => (
                <div key={stage.label} className="flex items-center gap-4">
                  <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                  <span className="flex-1 text-gray-600">{stage.label}</span>
                  <span className="font-medium text-gray-900">{stage.count}</span>
                </div>
              ))}
            </div>
          </MercuryCardContent>
          <MercuryCardFooter>
            <MercuryButton variant="text" size="sm" onClick={() => router.push("/portal/leads")}>
              Ver pipeline completo
            </MercuryButton>
          </MercuryCardFooter>
        </MercuryCard>
      </div>
    </PageContainer>
  );
}

