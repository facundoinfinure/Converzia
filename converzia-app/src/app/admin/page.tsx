"use client";

// Force dynamic rendering
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Building2,
  TrendingUp,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  Package,
  LayoutDashboard,
  Plus,
  Megaphone,
  Settings,
  ChevronDown,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { MercuryCard, MercuryCardHeader, MercuryCardTitle, MercuryCardContent, MercuryCardFooter } from "@/components/ui/MercuryCard";
import { MercuryButton } from "@/components/ui/MercuryButton";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SimpleChart } from "@/components/ui/SimpleChart";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
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
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient();
      setIsLoading(true);

      try {
        // Fetch counts in parallel
        const [
          { count: totalLeads },
          { count: activeTenants },
          { count: pendingApprovals },
          { data: unmappedLeads },
        ] = await Promise.all([
          supabase.from("lead_offers").select("id", { count: "exact", head: true }),
          supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
          supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL"),
          supabase.from("lead_offers").select("id").eq("status", "PENDING_MAPPING"),
        ]);

        // Get today's leads
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: leadsToday } = await supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString());

        // Get lead ready count for rate
        const { count: leadReadyCount } = await supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .in("status", ["LEAD_READY", "SENT_TO_DEVELOPER"]);

        // Get low credit tenants
        const { data: creditData } = await supabase
          .from("tenant_credit_balance")
          .select("tenant_id, current_balance")
          .lt("current_balance", 10);

        // Calculate average response time (real calculation)
        const { data: responseTimes } = await supabase
          .from("lead_offers")
          .select("created_at, first_response_at")
          .not("first_response_at", "is", null)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(100);

        let avgResponseTime = "N/A";
        if (responseTimes && responseTimes.length > 0) {
          const times = responseTimes
            .map((r: any) => {
              const created = new Date(r.created_at).getTime();
              const responded = new Date(r.first_response_at).getTime();
              return (responded - created) / 1000 / 60; // minutes
            })
            .filter((t: number) => t > 0 && t < 1440); // Filter outliers (0-24h)

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

          const { count } = await supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .gte("created_at", date.toISOString())
            .lt("created_at", nextDay.toISOString());

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
          unmappedAds: unmappedLeads?.length || 0,
          lowCreditTenants: creditData?.length || 0,
          leadsTrend: trendData,
        });

        // Fetch pending approvals
        const { data: approvals } = await supabase
          .from("tenant_members")
          .select(`
            id,
            role,
            created_at,
            user_profiles(full_name, email),
            tenants(name)
          `)
          .eq("status", "PENDING_APPROVAL")
          .order("created_at", { ascending: false })
          .limit(5);

        if (approvals) {
          setPendingApprovals(
            approvals.map((a: any) => ({
              id: a.id,
              name: a.user_profiles?.full_name || "Usuario",
              email: a.user_profiles?.email || "",
              tenant: a.tenants?.name || "Sin tenant",
              role: a.role,
              requestedAt: formatRelativeTime(a.created_at),
            }))
          );
        }

        // Fetch recent activity (simplified - in production would be from activity_logs)
        const { data: recentLeads } = await supabase
          .from("lead_offers")
          .select(`
            id,
            status,
            created_at,
            tenants(name)
          `)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentLeads) {
          setRecentActivity(
            recentLeads.map((l: any) => ({
              id: l.id,
              type: l.status === "LEAD_READY" ? "lead_ready" : l.status === "PENDING_MAPPING" ? "unmapped" : "conversation",
              tenant: l.tenants?.name || "Sin tenant",
              message: l.status === "LEAD_READY" ? "Nuevo lead listo para entrega" : l.status === "PENDING_MAPPING" ? "Lead sin mapear" : "Conversación activa",
              time: formatRelativeTime(l.created_at),
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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
          <Skeleton className="h-10 w-48" />
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
    lead_ready: { icon: CheckCircle2, bg: "bg-emerald-500/20", color: "text-emerald-400" },
    unmapped: { icon: AlertTriangle, bg: "bg-amber-500/20", color: "text-amber-400" },
    conversation: { icon: MessageSquare, bg: "bg-blue-500/20", color: "text-blue-400" },
    approval: { icon: Users, bg: "bg-purple-500/20", color: "text-purple-400" },
  };

  // Check if there's no data at all
  const hasNoData = stats && 
    stats.totalLeads === 0 && 
    stats.activeTenants === 0 && 
    stats.leadReadyRate === 0 &&
    recentActivity.length === 0 &&
    pendingApprovals.length === 0;

  // Quick actions for admin
  const quickActions = [
    {
      label: "Crear Tenant",
      icon: <Plus className="h-4 w-4" />,
      onClick: () => router.push("/admin/tenants/new"),
      variant: "primary" as const,
    },
    {
      label: "Mapear Ad",
      icon: <Megaphone className="h-4 w-4" />,
      onClick: () => router.push("/admin/ads-mapping"),
      variant: "secondary" as const,
    },
    {
      label: "Nueva Oferta",
      icon: <Package className="h-4 w-4" />,
      onClick: () => router.push("/admin/offers/new"),
      variant: "secondary" as const,
    },
    {
      label: "Ver Aprobaciones",
      icon: <Users className="h-4 w-4" />,
      onClick: () => router.push("/admin/users"),
      variant: "secondary" as const,
      disabled: (stats?.pendingApprovals || 0) === 0,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Vista general de la plataforma Converzia"
      />

      {hasNoData ? (
        <MercuryCard>
          <EmptyState
            icon={<LayoutDashboard />}
            title="Sin información disponible"
            description="Aún no hay datos para mostrar en el dashboard. Los datos aparecerán aquí cuando haya actividad en la plataforma."
            size="lg"
          />
        </MercuryCard>
      ) : (
        <div className="space-y-6">
          {/* Quick Actions - Estilo Mercury */}
          <div className="flex items-center justify-between">
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

          {/* Main Metric Card - Estilo Mercury */}
          <MercuryCard className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <MercuryCardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <MercuryCardTitle className="text-gray-600 text-sm font-medium">
                    Total Leads
                  </MercuryCardTitle>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {stats?.totalLeads.toLocaleString() || "0"}
                    </span>
                    <span className="text-gray-600">leads</span>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as any)}
                      className="text-sm text-gray-600 bg-white border border-gray-200 rounded-md px-2 py-1"
                    >
                      <option value="7d">Últimos 7 días</option>
                      <option value="30d">Últimos 30 días</option>
                      <option value="90d">Últimos 90 días</option>
                    </select>
                    <div className="text-sm text-gray-600">
                      {stats?.leadsToday || 0} leads hoy
                    </div>
                  </div>
                </div>
              </div>
            </MercuryCardHeader>
            <MercuryCardContent>
              {stats?.leadsTrend && stats.leadsTrend.length > 0 && (
                <div className="mt-4">
                  <SimpleChart
                    data={stats.leadsTrend}
                    color="#3b82f6"
                    height={120}
                    showGrid={false}
                    showAxis={false}
                  />
                </div>
              )}
            </MercuryCardContent>
          </MercuryCard>

          {/* Stats Grid - Estilo Mercury */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardCard
              title="Tenants Activos"
              value={stats?.activeTenants || 0}
              change={{ value: 2, trend: "up", label: "este mes" }}
              action={{
                label: "Ver todos",
                onClick: () => router.push("/admin/tenants"),
              }}
            />
            <DashboardCard
              title="Lead Ready Rate"
              value={`${stats?.leadReadyRate || 0}%`}
              change={{ value: 5.2, trend: "up", label: "vs. mes anterior" }}
            />
            <DashboardCard
              title="Tiempo Respuesta"
              value={stats?.avgResponseTime || "N/A"}
              change={{ value: -18, trend: "down", label: "mejorado" }}
            />
            <DashboardCard
              title="Leads Hoy"
              value={stats?.leadsToday || 0}
            />
          </div>

          {/* Alerts Row - Estilo Mercury */}
          {(stats?.unmappedAds || 0) > 0 && (
            <MercuryCard className="border-amber-200 bg-amber-50">
              <MercuryCardContent>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {stats?.unmappedAds} Ads sin mapear
                    </h3>
                    <p className="text-sm text-gray-600">
                      Hay leads esperando ser procesados. Mapeá los ads a ofertas para iniciar la calificación.
                    </p>
                  </div>
                  <Link href="/admin/ads-mapping">
                    <MercuryButton variant="primary" size="sm">
                      Mapear ahora
                    </MercuryButton>
                  </Link>
                </div>
              </MercuryCardContent>
            </MercuryCard>
          )}

          {/* Cards Informativos - Estilo Mercury */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <MercuryCard>
              <MercuryCardHeader>
                <MercuryCardTitle>Actividad Reciente</MercuryCardTitle>
              </MercuryCardHeader>
              <MercuryCardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => {
                      const config = activityIcons[activity.type];
                      const Icon = config.icon;
                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className={`h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center`}>
                            <Icon className={`h-5 w-5 text-gray-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{activity.message}</p>
                            <p className="text-sm text-gray-500">{activity.tenant}</p>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">{activity.time}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-500">
                      No hay actividad reciente
                    </div>
                  )}
                </div>
              </MercuryCardContent>
              <MercuryCardFooter>
                <MercuryButton variant="text" size="sm" onClick={() => router.push("/admin/operations")}>
                  Ver todas
                </MercuryButton>
              </MercuryCardFooter>
            </MercuryCard>

            {/* Pending Approvals */}
            <MercuryCard>
              <MercuryCardHeader>
                <div className="flex items-center justify-between w-full">
                  <MercuryCardTitle>Aprobaciones Pendientes</MercuryCardTitle>
                  {(stats?.pendingApprovals || 0) > 0 && (
                    <Badge variant="warning">{stats?.pendingApprovals} pendientes</Badge>
                  )}
                </div>
              </MercuryCardHeader>
              <MercuryCardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {pendingApprovals.length > 0 ? (
                    pendingApprovals.map((approval) => (
                      <div
                        key={approval.id}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                            {approval.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{approval.name}</p>
                            <p className="text-sm text-gray-500">{approval.tenant}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="default">{approval.role}</Badge>
                          <MercuryButton size="sm" variant="primary">
                            Aprobar
                          </MercuryButton>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-500">
                      No hay aprobaciones pendientes
                    </div>
                  )}
                </div>
              </MercuryCardContent>
              <MercuryCardFooter>
                <MercuryButton variant="text" size="sm" onClick={() => router.push("/admin/users")}>
                  Ver todas
                </MercuryButton>
              </MercuryCardFooter>
            </MercuryCard>
          </div>

          {/* Low Credit Tenants Alert - Estilo Mercury */}
          {(stats?.lowCreditTenants || 0) > 0 && (
            <MercuryCard className="border-red-200 bg-red-50">
              <MercuryCardContent>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {stats?.lowCreditTenants} Tenants con créditos bajos
                    </h3>
                    <p className="text-sm text-gray-600">
                      Estos tenants tienen menos de 10 créditos y podrían dejar de procesar leads pronto.
                    </p>
                  </div>
                  <Link href="/admin/tenants?filter=low_credits">
                    <MercuryButton variant="primary" size="sm">
                      Ver tenants
                    </MercuryButton>
                  </Link>
                </div>
              </MercuryCardContent>
            </MercuryCard>
          )}
        </div>
      )}
    </PageContainer>
  );
}

