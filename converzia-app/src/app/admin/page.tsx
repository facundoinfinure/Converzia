"use client";

// Force dynamic rendering
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

        setStats({
          totalLeads: totalLeads || 0,
          leadsToday: leadsToday || 0,
          activeTenants: activeTenants || 0,
          leadReadyRate: totalLeads ? Math.round((leadReadyCount || 0) / totalLeads * 100) : 0,
          avgResponseTime: "2.4min",
          pendingApprovals: pendingApprovals || 0,
          unmappedAds: unmappedLeads?.length || 0,
          lowCreditTenants: creditData?.length || 0,
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

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Vista general de la plataforma Converzia"
      />

      {/* Stats Grid */}
      <StatsGrid columns={4} className="mb-6">
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads.toLocaleString() || "0"}
          icon={<Users />}
          iconColor="from-blue-500 to-cyan-500"
          change={12.5}
          trend="up"
          changeLabel="vs. mes anterior"
        />
        <StatCard
          title="Tenants Activos"
          value={stats?.activeTenants || 0}
          icon={<Building2 />}
          iconColor="from-emerald-500 to-teal-500"
          change={2}
          trend="up"
        />
        <StatCard
          title="Lead Ready Rate"
          value={`${stats?.leadReadyRate || 0}%`}
          icon={<TrendingUp />}
          iconColor="from-purple-500 to-pink-500"
          change={5.2}
          trend="up"
        />
        <StatCard
          title="Tiempo Respuesta"
          value={stats?.avgResponseTime || "N/A"}
          icon={<Clock />}
          iconColor="from-amber-500 to-orange-500"
          change={-18}
          trend="down"
        />
      </StatsGrid>

      {/* Alerts Row */}
      {(stats?.unmappedAds || 0) > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-400">
                  {stats?.unmappedAds} Ads sin mapear
                </h3>
                <p className="text-sm text-slate-400">
                  Hay leads esperando ser procesados. Mapeá los ads a ofertas para iniciar la calificación.
                </p>
              </div>
              <Link href="/admin/ads-mapping">
                <Button variant="secondary">Ver Ads sin mapear</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-card-border">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => {
                  const config = activityIcons[activity.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-card-border/50 transition-colors"
                    >
                      <div className={`h-10 w-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.message}</p>
                        <p className="text-sm text-slate-500">{activity.tenant}</p>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{activity.time}</span>
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-8 text-center text-slate-500">
                  No hay actividad reciente
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Aprobaciones Pendientes</CardTitle>
            {(stats?.pendingApprovals || 0) > 0 && (
              <Badge variant="warning">{stats?.pendingApprovals} pendientes</Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-card-border">
              {pendingApprovals.length > 0 ? (
                pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-card-border/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center text-white font-medium">
                        {approval.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{approval.name}</p>
                        <p className="text-sm text-slate-500">{approval.tenant}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default">{approval.role}</Badge>
                      <Button size="xs" variant="success">
                        Aprobar
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-slate-500">
                  No hay aprobaciones pendientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      {(stats?.lowCreditTenants || 0) > 0 && (
        <Card className="mt-6 border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-400">
                  {stats?.lowCreditTenants} Tenants con créditos bajos
                </h3>
                <p className="text-sm text-slate-400">
                  Estos tenants tienen menos de 10 créditos y podrían dejar de procesar leads pronto.
                </p>
              </div>
              <Link href="/admin/tenants?filter=low_credits">
                <Button variant="secondary">Ver tenants</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

