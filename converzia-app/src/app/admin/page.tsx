"use client";

// Force dynamic rendering
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
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { LightCard, LightCardHeader, LightCardTitle, LightCardContent, LightCardFooter } from "@/components/ui/LightCard";
import { LightButton } from "@/components/ui/LightButton";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SimpleChart } from "@/components/ui/SimpleChart";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
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
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient();
      setIsLoading(true);
      setError(null);

      console.log("🔍 Starting dashboard data fetch...");

      // Verify authentication first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("❌ Auth error:", authError);
        console.error("User:", user);
        setError(`Error de autenticación: ${authError?.message || "Usuario no encontrado"}. Por favor, recargá la página o iniciá sesión nuevamente.`);
        setIsLoading(false);
        return;
      }

      console.log("✅ User authenticated:", user.id);

      try {
        // Fetch counts in parallel with timeout
        console.log("Fetching dashboard counts with 10s timeout...");
        const [
          { count: totalLeads, error: leadsError },
          { count: activeTenants, error: tenantsError },
          { count: pendingApprovals, error: approvalsError },
          { data: unmappedLeads, error: unmappedError },
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

        if (leadsError || tenantsError || approvalsError || unmappedError) {
          console.error("❌ Error fetching dashboard counts:", { 
            leadsError: leadsError?.message || leadsError?.code, 
            tenantsError: tenantsError?.message || tenantsError?.code, 
            approvalsError: approvalsError?.message || approvalsError?.code, 
            unmappedError: unmappedError?.message || unmappedError?.code 
          });
          
          // Set error if all queries failed
          if (leadsError && tenantsError && approvalsError && unmappedError) {
            setError(`Error al cargar datos: ${leadsError.message || "Error desconocido"}. Verificá la consola para más detalles.`);
          }
        } else {
          console.log("✅ Dashboard counts loaded successfully");
        }

        // Get today's leads
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: leadsToday, error: leadsTodayError } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .gte("created_at", today.toISOString()),
          10000,
          "today's leads"
        );

        if (leadsTodayError) {
          console.error("Error fetching today's leads:", leadsTodayError);
        }

        // Get lead ready count for rate
        const { count: leadReadyCount, error: leadReadyError } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .in("status", ["LEAD_READY", "SENT_TO_DEVELOPER"]),
          10000,
          "lead ready count"
        );

        if (leadReadyError) {
          console.error("Error fetching lead ready count:", leadReadyError);
        }

        // Get low credit tenants
        const { data: creditData, error: creditError } = await queryWithTimeout(
          supabase
            .from("tenant_credit_balance")
            .select("tenant_id, current_balance")
            .lt("current_balance", 10),
          10000,
          "low credit tenants"
        );

        if (creditError) {
          console.error("Error fetching credit data:", creditError);
        }

        // Calculate average response time (real calculation)
        const { data: responseTimes, error: responseTimesError } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("created_at, first_response_at")
            .not("first_response_at", "is", null)
            .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(100),
          10000,
          "response times"
        );

        if (responseTimesError) {
          console.error("Error fetching response times:", responseTimesError);
        }

        let avgResponseTime = "N/A";
        if (responseTimes && Array.isArray(responseTimes) && responseTimes.length > 0) {
          const times = (responseTimes as any[])
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

          const { count, error: trendError } = await queryWithTimeout(
            supabase
              .from("lead_offers")
              .select("id", { count: "exact", head: true })
              .gte("created_at", date.toISOString())
              .lt("created_at", nextDay.toISOString()),
            5000,
            `trend data for day ${i}`
          );

          if (trendError) {
            console.error("Error fetching trend data:", trendError);
          }

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
        const { data: approvals, error: approvalsDataError } = await queryWithTimeout(
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

        if (approvalsDataError) {
          console.error("Error fetching approvals:", approvalsDataError);
        } else if (approvals && Array.isArray(approvals)) {
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

        // Fetch recent activity (simplified - in production would be from activity_logs)
        const { data: recentLeads, error: recentLeadsError } = await queryWithTimeout(
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

        if (recentLeadsError) {
          console.error("Error fetching recent leads:", recentLeadsError);
        } else if (recentLeads && Array.isArray(recentLeads)) {
          setRecentActivity(
            (recentLeads as any[]).map((l: any) => ({
              id: l.id,
              type: l.status === "LEAD_READY" ? "lead_ready" : l.status === "PENDING_MAPPING" ? "unmapped" : "conversation",
              tenant: l.tenants?.name || "Sin tenant",
              message: l.status === "LEAD_READY" ? "Nuevo lead listo para entrega" : l.status === "PENDING_MAPPING" ? "Lead sin mapear" : "Conversación activa",
              time: formatRelativeTime(l.created_at),
            }))
          );
        }
      } catch (error: any) {
        console.error("❌ Error fetching dashboard data:", error);
        const errorMessage = error?.message || "Error al cargar los datos del dashboard. Intentá recargar la página.";
        setError(errorMessage);
        
        // Log additional diagnostic info
        if (error instanceof Error) {
          console.error("Error stack:", error.stack);
        }
      } finally {
        setIsLoading(false);
        console.log("🏁 Dashboard data fetch completed");
      }
    }

    fetchDashboardData();
  }, [timeRange]);

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

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Vista general de la plataforma Converzia"
      />

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <p className="font-medium">Error al cargar datos</p>
          <p className="text-sm mt-1">{error}</p>
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              Recargar página
            </button>
            <button
              onClick={() => {
                // Clear localStorage and sessionStorage
                localStorage.clear();
                sessionStorage.clear();
                // Clear cookies related to Supabase
                document.cookie.split(";").forEach((c) => {
                  const eqPos = c.indexOf("=");
                  const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
                  if (name.includes("supabase") || name.includes("sb-")) {
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                  }
                });
                window.location.href = "/login";
              }}
              className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              Limpiar cache e iniciar sesión
            </button>
          </div>
        </div>
      )}

      {hasNoData ? (
        <LightCard>
          <EmptyState
            icon={<LayoutDashboard />}
            title="Sin información disponible"
            description="Aún no hay datos para mostrar en el dashboard. Los datos aparecerán aquí cuando haya actividad en la plataforma."
            size="lg"
          />
        </LightCard>
      ) : (
        <div className="space-y-6">
          {/* Alerts Row - Show actionable items first */}
          {(stats?.unmappedAds || 0) > 0 && (
            <LightCard className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <LightCardContent>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {stats?.unmappedAds} ads sin mapear
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Hay leads esperando. Mapeá los ads para iniciar la calificación.
                    </p>
                  </div>
                  <Link href="/admin/ads-mapping">
                    <LightButton variant="primary" size="sm">
                      Mapear ahora
                    </LightButton>
                  </Link>
                </div>
              </LightCardContent>
            </LightCard>
          )}

          {(stats?.pendingApprovals || 0) > 0 && (
            <LightCard className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30">
              <LightCardContent>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {stats?.pendingApprovals} aprobaciones pendientes
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Usuarios esperando acceso a la plataforma.
                    </p>
                  </div>
                  <Link href="/admin/users">
                    <LightButton variant="primary" size="sm">
                      Revisar
                    </LightButton>
                  </Link>
                </div>
              </LightCardContent>
            </LightCard>
          )}

          {/* Main Metric Card */}
          <LightCard className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-800">
            <LightCardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <LightCardTitle className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                    Total Leads
                  </LightCardTitle>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-bold text-gray-900 dark:text-slate-100">
                      {stats?.totalLeads.toLocaleString() || "0"}
                    </span>
                    <span className="text-gray-600 dark:text-slate-400">leads</span>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as any)}
                      className="text-sm text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-md px-2 py-1"
                    >
                      <option value="7d">Últimos 7 días</option>
                      <option value="30d">Últimos 30 días</option>
                      <option value="90d">Últimos 90 días</option>
                    </select>
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      {stats?.leadsToday || 0} leads hoy
                    </div>
                  </div>
                </div>
              </div>
            </LightCardHeader>
            <LightCardContent>
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
            </LightCardContent>
          </LightCard>

          {/* Stats Grid */}
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


          {/* Cards Informativos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <LightCard>
              <LightCardHeader>
                <LightCardTitle>Actividad Reciente</LightCardTitle>
              </LightCardHeader>
              <LightCardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity) => {
                      const config = activityIcons[activity.type];
                      const Icon = config.icon;
                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <div className={`h-10 w-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center`}>
                            <Icon className={`h-5 w-5 text-gray-600 dark:text-slate-400`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{activity.message}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">{activity.tenant}</p>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-500 whitespace-nowrap">{activity.time}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                      No hay actividad reciente
                    </div>
                  )}
                </div>
              </LightCardContent>
              <LightCardFooter>
                <LightButton variant="text" size="sm" onClick={() => router.push("/admin/operations")}>
                  Ver todas
                </LightButton>
              </LightCardFooter>
            </LightCard>

            {/* Pending Approvals */}
            <LightCard>
              <LightCardHeader>
                <div className="flex items-center justify-between w-full">
                  <LightCardTitle>Aprobaciones Pendientes</LightCardTitle>
                  {(stats?.pendingApprovals || 0) > 0 && (
                    <Badge variant="warning">{stats?.pendingApprovals} pendientes</Badge>
                  )}
                </div>
              </LightCardHeader>
              <LightCardContent className="p-0">
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                  {pendingApprovals.length > 0 ? (
                    pendingApprovals.map((approval) => (
                      <div
                        key={approval.id}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                            {approval.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{approval.name}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">{approval.tenant}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="default">{approval.role}</Badge>
                          <LightButton size="sm" variant="primary">
                            Aprobar
                          </LightButton>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                      No hay aprobaciones pendientes
                    </div>
                  )}
                </div>
              </LightCardContent>
              <LightCardFooter>
                <LightButton variant="text" size="sm" onClick={() => router.push("/admin/users")}>
                  Ver todas
                </LightButton>
              </LightCardFooter>
            </LightCard>
          </div>

          {/* Low Credit Tenants Alert */}
          {(stats?.lowCreditTenants || 0) > 0 && (
            <LightCard className="border-red-200 bg-red-50">
              <LightCardContent>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {stats?.lowCreditTenants} Tenants con créditos bajos
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Estos tenants tienen menos de 10 créditos y podrían dejar de procesar leads pronto.
                    </p>
                  </div>
                  <Link href="/admin/tenants?filter=low_credits">
                    <LightButton variant="primary" size="sm">
                      Ver tenants
                    </LightButton>
                  </Link>
                </div>
              </LightCardContent>
            </LightCard>
          )}
        </div>
      )}
    </PageContainer>
  );
}

