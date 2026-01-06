"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  LayoutDashboard,
  Building2,
  TrendingUp,
  Clock,
  Zap,
  ArrowRight,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { 
  DashboardCard, 
  HeroMetric, 
  AlertCard, 
  ActivityItem 
} from "@/components/dashboard/DashboardCard";
import { SimpleChart } from "@/components/ui/SimpleChart";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatRelativeTime } from "@/lib/utils";
import { useAdmin } from "@/lib/contexts/admin-context";

interface DashboardStats {
  totalLeads: number;
  leadsToday: number;
  activeTenants: number;
  leadReadyRate: number;
  avgResponseTime: string;
  pendingApprovals: number;
  unmappedAds: number;
  lowCreditTenants: number;
  leadsTrend?: Array<{ date: string; value: number }>;
}

interface RecentActivity {
  id: string;
  type: "lead_ready" | "unmapped" | "conversation" | "approval";
  tenant: string;
  message: string;
  time: string;
}

interface PendingApproval {
  id: string;
  name: string;
  email: string;
  tenant: string;
  role: string;
  requestedAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  // Use admin context instead of local state
  const {
    stats: contextStats,
    recentActivity: contextActivity,
    pendingApprovals: contextApprovals,
    isInitialLoading,
    isLoading,
    errors,
    refreshAll,
  } = useAdmin();

  // For backward compatibility, return isLoading as combined state
  const isLoadingCombined = isInitialLoading || isLoading.stats || isLoading.activity || isLoading.approvals;
  const error = errors.stats || errors.activity || errors.approvals || null;

  // Map context data to component types (context types match, so direct assignment)
  const stats: DashboardStats | null = contextStats;
  
  // Map recent activity - context uses different structure, need to transform
  const recentActivity: RecentActivity[] = contextActivity.map((a) => ({
    id: a.id,
    type: (a.type || "conversation") as "lead_ready" | "unmapped" | "conversation" | "approval",
    tenant: a.metadata?.tenant || "Sin tenant",
    message: a.description || "",
    time: formatRelativeTime(a.timestamp),
  }));

  // Map pending approvals - context structure matches what we need
  const pendingApprovals: PendingApproval[] = contextApprovals.map((a) => ({
    id: a.id,
    name: a.user_name || "Usuario",
    email: a.user_email || "",
    tenant: a.tenant_name || "Sin tenant",
    role: "VIEWER", // Default role - could be stored in context if needed
    requestedAt: formatRelativeTime(a.requested_at),
  }));

  if (isLoadingCombined) {
    return (
      <PageContainer>
        <div className="space-y-4 sm:space-y-6 animate-pulse">
          <Skeleton className="h-10 w-48 sm:w-64" />
          <Skeleton className="h-36 sm:h-40 rounded-2xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 sm:h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Skeleton className="h-56 sm:h-64 rounded-2xl" />
            <Skeleton className="h-56 sm:h-64 rounded-2xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  const activityIcons = {
    lead_ready: { icon: CheckCircle2, color: "success" as const },
    unmapped: { icon: AlertTriangle, color: "warning" as const },
    conversation: { icon: MessageSquare, color: "primary" as const },
    approval: { icon: Users, color: "info" as const },
  };

  const hasNoData = stats && 
    stats.totalLeads === 0 && 
    stats.activeTenants === 0 && 
    recentActivity.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Vista general de la plataforma"
        compact
      />

      {error && (
        <AlertCard
          type="danger"
          title="Error al cargar datos"
          description={error}
          action={{
            label: "Recargar",
            onClick: () => window.location.reload(),
          }}
          className="mb-4 sm:mb-6"
        />
      )}

      {hasNoData ? (
        <Card className="animate-fadeInUp">
          <EmptyState
            icon={<LayoutDashboard />}
            title="Sin información disponible"
            description="Los datos aparecerán aquí cuando haya actividad en la plataforma."
            size="lg"
          />
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Actionable Alerts - Stack on mobile */}
          <div className="space-y-3">
            {(stats?.unmappedAds || 0) > 0 && (
              <AlertCard
                type="warning"
                icon={<AlertTriangle className="h-5 w-5" />}
                title={`${stats?.unmappedAds} ads sin mapear`}
                description="Hay leads esperando. Mapeá los ads para iniciar la calificación."
                action={{
                  label: "Mapear",
                  onClick: () => router.push("/admin/ads-mapping"),
                }}
              />
            )}

            {(stats?.pendingApprovals || 0) > 0 && (
              <AlertCard
                type="info"
                icon={<Users className="h-5 w-5" />}
                title={`${stats?.pendingApprovals} aprobaciones pendientes`}
                description="Usuarios esperando acceso a la plataforma."
                action={{
                  label: "Revisar",
                  onClick: () => router.push("/admin/users"),
                }}
              />
            )}

            {(stats?.lowCreditTenants || 0) > 0 && (
              <AlertCard
                type="danger"
                icon={<CreditCard className="h-5 w-5" />}
                title={`${stats?.lowCreditTenants} tenants con créditos bajos`}
                description="Estos tenants tienen menos de 10 créditos."
                action={{
                  label: "Ver",
                  onClick: () => router.push("/admin/tenants?filter=low_credits"),
                }}
              />
            )}
          </div>

          {/* Hero Metric - Total Leads */}
          <HeroMetric
            title="Total Leads"
            value={stats?.totalLeads.toLocaleString() || "0"}
            subtitle="leads"
            icon={<Zap className="h-6 w-6" />}
            accentColor="primary"
            trend={
              stats?.leadsToday && stats.leadsToday > 0
                ? { value: stats.leadsToday, label: "hoy", direction: "up" }
                : undefined
            }
            chart={
              stats?.leadsTrend && stats.leadsTrend.length > 0 && (
                <SimpleChart
                  data={stats.leadsTrend}
                  color="var(--accent-primary)"
                  height={80}
                  showGrid={false}
                  showAxis={false}
                />
              )
            }
          />

          {/* Stats Grid - 2 columns on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <DashboardCard
              title="Tenants"
              value={stats?.activeTenants || 0}
              icon={<Building2 className="h-5 w-5" />}
              iconColor="primary"
              size="sm"
              action={{
                label: "Ver",
                onClick: () => router.push("/admin/tenants"),
              }}
            />
            <DashboardCard
              title="Lead Ready"
              value={`${stats?.leadReadyRate || 0}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              iconColor="success"
              size="sm"
            />
            <DashboardCard
              title="T. Respuesta"
              value={stats?.avgResponseTime || "N/A"}
              icon={<Clock className="h-5 w-5" />}
              iconColor="info"
              size="sm"
            />
            <DashboardCard
              title="Leads Hoy"
              value={stats?.leadsToday || 0}
              icon={<Users className="h-5 w-5" />}
              iconColor="warning"
              size="sm"
            />
          </div>

          {/* Two column layout - Stack on mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Recent Activity */}
            <Card className="animate-fadeInUp stagger-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle size="sm">Actividad Reciente</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/admin/operations")}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    <span className="hidden sm:inline">Ver todas</span>
                    <span className="sm:hidden">Ver</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent noPadding>
                {recentActivity.length > 0 ? (
                  <div className="divide-y divide-[var(--border-primary)]">
                    {recentActivity.map((activity) => {
                      const config = activityIcons[activity.type];
                      const Icon = config.icon;
                      return (
                        <ActivityItem
                          key={activity.id}
                          icon={<Icon className="h-4 w-4" />}
                          iconColor={config.color}
                          title={activity.message}
                          subtitle={activity.tenant}
                          timestamp={activity.time}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 sm:py-12 text-center">
                    <MessageSquare className="h-10 w-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)] font-semibold">Sin actividad reciente</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Approvals */}
            <Card className="animate-fadeInUp stagger-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle size="sm">Aprobaciones Pendientes</CardTitle>
                  {(stats?.pendingApprovals || 0) > 0 && (
                    <Badge variant="warning">{stats?.pendingApprovals}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent noPadding>
                {pendingApprovals.length > 0 ? (
                  <div className="divide-y divide-[var(--border-primary)]">
                    {pendingApprovals.map((approval) => (
                      <div
                        key={approval.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary-light)] to-purple-100 flex items-center justify-center text-[var(--accent-primary)] font-bold text-sm flex-shrink-0">
                            {approval.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                              {approval.name}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)] truncate">
                              {approval.tenant}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-auto sm:ml-0">
                          <Badge variant="default" className="text-xs">{approval.role}</Badge>
                          <Button size="sm" variant="primary">
                            Aprobar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 sm:py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-[var(--success)] mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)] font-semibold">
                      Sin aprobaciones pendientes
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
