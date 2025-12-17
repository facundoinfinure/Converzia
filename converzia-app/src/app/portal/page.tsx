"use client";

// Force dynamic rendering
export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Users,
  TrendingUp,
  CreditCard,
  Package,
  ArrowRight,
  CheckCircle,
  Clock,
  MessageSquare,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, LeadStatusBadge } from "@/components/ui/Badge";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { OnboardingChecklist } from "@/components/portal/OnboardingChecklist";
import { useAuth } from "@/lib/auth/context";
import { usePortalDashboard } from "@/lib/hooks/use-portal";
import { formatRelativeTime } from "@/lib/utils";

export default function PortalDashboard() {
  const { activeTenant } = useAuth();
  const { stats, recentLeads, isLoading, error } = usePortalDashboard();

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

      {/* Onboarding checklist */}
      {activeTenant && <OnboardingChecklist tenantId={activeTenant.id} />}

      {/* Low credits warning */}
      {stats && stats.creditBalance < 10 && (
        <Alert variant="warning" className="mb-6" title="Créditos bajos">
          Tenés solo {stats.creditBalance} créditos restantes.{" "}
          <Link href="/portal/billing" className="underline">
            Recargá ahora
          </Link>{" "}
          para seguir recibiendo leads.
        </Alert>
      )}

      {/* Stats */}
      <StatsGrid columns={4} className="mb-6">
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          icon={<Users />}
          iconColor="from-blue-500 to-cyan-500"
        />
        <StatCard
          title="Leads Ready"
          value={stats?.leadReadyCount || 0}
          icon={<CheckCircle />}
          iconColor="from-emerald-500 to-teal-500"
        />
        <StatCard
          title="Tasa de conversión"
          value={`${stats?.conversionRate || 0}%`}
          icon={<TrendingUp />}
          iconColor="from-purple-500 to-pink-500"
        />
        <StatCard
          title="Créditos"
          value={stats?.creditBalance || 0}
          icon={<CreditCard />}
          iconColor={stats && stats.creditBalance < 10 ? "from-amber-500 to-orange-500" : "from-slate-500 to-slate-600"}
          trend={stats && stats.creditBalance < 10 ? "down" : "neutral"}
        />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card>
          <CardHeader action={
            <Link href="/portal/leads">
              <Button size="sm" variant="ghost" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Ver todos
              </Button>
            </Link>
          }>
            <CardTitle>Leads recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentLeads.length > 0 ? (
              <div className="divide-y divide-card-border">
                {recentLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-card-border/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {lead.lead?.full_name || lead.lead?.phone || "Lead"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {lead.offer?.name || "Sin oferta"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <LeadStatusBadge status={lead.status} />
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(lead.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-slate-500">
                No hay leads todavía. Cuando lleguen leads de tus campañas, aparecerán aquí.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats & Actions */}
        <div className="space-y-6">
          {/* Pipeline Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline de leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Contactados", count: 0, color: "bg-blue-500" },
                  { label: "En calificación", count: 0, color: "bg-purple-500" },
                  { label: "Lead Ready", count: stats?.leadReadyCount || 0, color: "bg-emerald-500" },
                  { label: "Entregados", count: stats?.deliveredCount || 0, color: "bg-slate-500" },
                ].map((stage) => (
                  <div key={stage.label} className="flex items-center gap-4">
                    <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                    <span className="flex-1 text-slate-400">{stage.label}</span>
                    <span className="font-medium text-white">{stage.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/portal/billing" className="block">
                <Button variant="secondary" fullWidth leftIcon={<CreditCard className="h-4 w-4" />}>
                  Recargar créditos
                </Button>
              </Link>
              <Link href="/portal/leads" className="block">
                <Button variant="secondary" fullWidth leftIcon={<Users className="h-4 w-4" />}>
                  Ver todos los leads
                </Button>
              </Link>
              <Link href="/portal/offers" className="block">
                <Button variant="secondary" fullWidth leftIcon={<Package className="h-4 w-4" />}>
                  Mis ofertas
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

