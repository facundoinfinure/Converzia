"use client";

// Force dynamic rendering
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  CreditCard,
  ArrowRight,
  Clock,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { LightCard, LightCardHeader, LightCardTitle, LightCardContent, LightCardFooter } from "@/components/ui/LightCard";
import { LightButton } from "@/components/ui/LightButton";
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

  // Fetch leads trend (fixed to 30 days - no user configuration needed)
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

  return (
    <PageContainer>
      <PageHeader
        title={`Bienvenido, ${activeTenant?.name || "Portal"}`}
        description="Vista general de tu cuenta"
      />

      {/* Onboarding checklist - only shown if incomplete */}
      {activeTenant && <OnboardingChecklist tenantId={activeTenant.id} />}

      {/* Low credits alert */}
      {stats && stats.creditBalance < 10 && (
        <LightCard className="border-amber-200 bg-amber-50 mb-6">
          <LightCardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Créditos bajos: {stats.creditBalance}
                </h3>
                <p className="text-sm text-gray-600">
                  Recargá para seguir recibiendo leads calificados.
                </p>
              </div>
              <LightButton variant="primary" size="sm" onClick={() => router.push("/portal/billing")}>
                Recargar
              </LightButton>
            </div>
          </LightCardContent>
        </LightCard>
      )}

      {/* Main Metric Card - Créditos (simplified, no time selector) */}
      <LightCard className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <LightCardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <LightCardTitle className="text-gray-600 text-sm font-medium">
                Créditos Disponibles
              </LightCardTitle>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold text-gray-900">
                  {stats?.creditBalance || 0}
                </span>
                <span className="text-gray-600">créditos</span>
              </div>
            </div>
          </div>
        </LightCardHeader>
        <LightCardContent>
          {leadsTrend.length > 0 && (
            <div className="mt-4">
              <span className="text-sm text-gray-600">Tendencia de leads (30 días)</span>
              <SimpleChart
                data={leadsTrend}
                color="#3b82f6"
                height={120}
                showGrid={false}
                showAxis={false}
              />
            </div>
          )}
        </LightCardContent>
        <LightCardFooter>
          <LightButton variant="primary" size="sm" onClick={() => router.push("/portal/billing")}>
            Recargar créditos
          </LightButton>
        </LightCardFooter>
      </LightCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          action={{
            label: "Ver por oferta",
            onClick: () => router.push("/portal/offers"),
          }}
        />
        <DashboardCard
          title="Leads Ready"
          value={stats?.leadReadyCount || 0}
          action={{
            label: "Ver por oferta",
            onClick: () => router.push("/portal/offers"),
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

      {/* Cards Informativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <LightCard>
          <LightCardHeader>
            <div className="flex items-center justify-between w-full">
              <LightCardTitle>Leads recientes</LightCardTitle>
              <Link href="/portal/offers">
                <LightButton size="sm" variant="text" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Ver por oferta
                </LightButton>
              </Link>
            </div>
          </LightCardHeader>
          <LightCardContent className="p-0">
            {recentLeads.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push("/portal/offers")}
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
          </LightCardContent>
        </LightCard>

        {/* Pipeline Summary - Con datos reales */}
        <LightCard>
          <LightCardHeader>
            <LightCardTitle>Pipeline de leads</LightCardTitle>
          </LightCardHeader>
          <LightCardContent>
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
          </LightCardContent>
          <LightCardFooter>
            <LightButton variant="text" size="sm" onClick={() => router.push("/portal/offers")}>
              Ver por oferta
            </LightButton>
          </LightCardFooter>
        </LightCard>
      </div>
    </PageContainer>
  );
}

