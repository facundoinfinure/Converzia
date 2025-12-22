"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient();
      setIsLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setError(`Error de autenticación: ${authError?.message || "Usuario no encontrado"}`);
        setIsLoading(false);
        return;
      }

      try {
        const [
          { count: totalLeads },
          { count: activeTenants },
          { count: pendingApprovals },
          { data: unmappedLeads },
        ] = await Promise.all([
          queryWithTimeout(
            supabase.from("lead_offers").select("id", { count: "exact", head: true }),
            10000,
            "lead_offers count"
          ),
          queryWithTimeout(
            supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
            10000,
            "tenants count"
          ),
          queryWithTimeout(
            supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL"),
            10000,
            "tenant_members count"
          ),
          queryWithTimeout(
            supabase.from("lead_offers").select("id").eq("status", "PENDING_MAPPING"),
            10000,
            "unmapped leads"
          ),
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: leadsToday } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .gte("created_at", today.toISOString()),
          10000,
          "today's leads"
        );

        const { count: leadReadyCount } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .in("status", ["LEAD_READY", "SENT_TO_DEVELOPER"]),
          10000,
          "lead ready count"
        );

        const { data: creditData } = await queryWithTimeout(
          supabase
            .from("tenant_credit_balance")
            .select("tenant_id, current_balance")
            .lt("current_balance", 10),
          10000,
          "low credit tenants"
        );

        const { data: responseTimes } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("created_at, first_response_at")
            .not("first_response_at", "is", null)
            .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(100),
          10000,
          "response times"
        );

        let avgResponseTime = "N/A";
        if (responseTimes && Array.isArray(responseTimes) && responseTimes.length > 0) {
          const times = (responseTimes as any[])
            .map((r: any) => {
              const created = new Date(r.created_at).getTime();
              const responded = new Date(r.first_response_at).getTime();
              return (responded - created) / 1000 / 60;
            })
            .filter((t: number) => t > 0 && t < 1440);

          if (times.length > 0) {
            const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length;
            avgResponseTime = `${avg.toFixed(1)}min`;
          }
        }

        // Get leads trend for last 30 days
        const daysAgo = 30;
        const trendData: Array<{ date: string; value: number }> = [];
        for (let i = daysAgo; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);

          const { count } = await queryWithTimeout(
            supabase
              .from("lead_offers")
              .select("id", { count: "exact", head: true })
              .gte("created_at", date.toISOString())
              .lt("created_at", nextDay.toISOString()),
            5000,
            `trend data for day ${i}`
          );

          trendData.push({
            date: date.toLocaleDateString("es-AR", { month: "short", day: "numeric" }),
            value: count || 0,
          });
        }

        setStats({
          totalLeads: totalLeads || 0,
          leadsToday: leadsToday || 0,
          activeTenants: activeTenants || 0,
          leadReadyRate: totalLeads ? Math.round((leadReadyCount || 0) / totalLeads * 100) : 0,
          avgResponseTime,
          pendingApprovals: pendingApprovals || 0,
          unmappedAds: Array.isArray(unmappedLeads) ? unmappedLeads.length : 0,
          lowCreditTenants: Array.isArray(creditData) ? creditData.length : 0,
          leadsTrend: trendData,
        });

        // Fetch pending approvals
        const { data: approvals } = await queryWithTimeout(
          supabase
            .from("tenant_members")
            .select(`
              id,
              role,
              created_at,
              user:user_profiles!tenant_members_user_id_fkey(full_name, email),
              tenant:tenants(name)
            `)
            .eq("status", "PENDING_APPROVAL")
            .order("created_at", { ascending: false })
            .limit(5),
          10000,
          "pending approvals"
        );

        if (approvals && Array.isArray(approvals)) {
          setPendingApprovals(
            (approvals as any[]).map((a: any) => ({
              id: a.id,
              name: (Array.isArray(a.user) ? a.user[0] : a.user)?.full_name || "Usuario",
              email: (Array.isArray(a.user) ? a.user[0] : a.user)?.email || "",
              tenant: (Array.isArray(a.tenant) ? a.tenant[0] : a.tenant)?.name || "Sin tenant",
              role: a.role,
              requestedAt: formatRelativeTime(a.created_at),
            }))
          );
        }

        // Fetch recent activity
        const { data: recentLeads } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select(`
              id,
              status,
              created_at,
              tenants(name)
            `)
            .order("created_at", { ascending: false })
            .limit(5),
          10000,
          "recent activity"
        );

        if (recentLeads && Array.isArray(recentLeads)) {
          setRecentActivity(
            (recentLeads as any[]).map((l: any) => ({
              id: l.id,
              type: l.status === "LEAD_READY" ? "lead_ready" : l.status === "PENDING_MAPPING" ? "unmapped" : "conversation",
              tenant: l.tenants?.name || "Sin tenant",
              message: l.status === "LEAD_READY" ? "Nuevo lead listo" : l.status === "PENDING_MAPPING" ? "Lead sin mapear" : "Conversación activa",
              time: formatRelativeTime(l.created_at),
            }))
          );
        }
      } catch (error: any) {
        setError(error?.message || "Error al cargar los datos");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

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
        description="Vista general de la plataforma Converzia"
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
          className="mb-6"
        />
      )}

      {hasNoData ? (
        <Card>
          <EmptyState
            icon={<LayoutDashboard />}
            title="Sin información disponible"
            description="Los datos aparecerán aquí cuando haya actividad en la plataforma."
            size="lg"
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Actionable Alerts */}
          {(stats?.unmappedAds || 0) > 0 && (
            <AlertCard
              type="warning"
              icon={<AlertTriangle className="h-5 w-5" />}
              title={`${stats?.unmappedAds} ads sin mapear`}
              description="Hay leads esperando. Mapeá los ads para iniciar la calificación."
              action={{
                label: "Mapear ahora",
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
                label: "Ver tenants",
                onClick: () => router.push("/admin/tenants?filter=low_credits"),
              }}
            />
          )}

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
              title="Tenants Activos"
              value={stats?.activeTenants || 0}
              icon={<Building2 className="h-5 w-5" />}
              iconColor="primary"
              action={{
                label: "Ver todos",
                onClick: () => router.push("/admin/tenants"),
              }}
            />
            <DashboardCard
              title="Tasa Lead Ready"
              value={`${stats?.leadReadyRate || 0}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              iconColor="success"
              change={
                stats?.leadReadyRate && stats.leadReadyRate > 0
                  ? { value: stats.leadReadyRate, trend: "up" as const }
                  : undefined
              }
            />
            <DashboardCard
              title="Tiempo Respuesta"
              value={stats?.avgResponseTime || "N/A"}
              icon={<Clock className="h-5 w-5" />}
              iconColor="info"
            />
            <DashboardCard
              title="Leads Hoy"
              value={stats?.leadsToday || 0}
              icon={<Users className="h-5 w-5" />}
              iconColor="warning"
            />
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Actividad Reciente</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/admin/operations")}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Ver todas
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
                  <div className="py-12 text-center">
                    <MessageSquare className="h-10 w-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">Sin actividad reciente</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Approvals */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Aprobaciones Pendientes</CardTitle>
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
                        className="flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center text-[var(--accent-primary)] font-medium text-sm">
                            {approval.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {approval.name}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {approval.tenant}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{approval.role}</Badge>
                          <Button size="sm" variant="primary">
                            Aprobar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-[var(--success)] mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">
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
