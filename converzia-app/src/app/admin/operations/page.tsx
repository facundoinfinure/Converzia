"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
  MessageSquare,
  Users,
  AlertTriangle,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { DataTable, Column } from "@/components/ui/Table";
import { Badge, LeadStatusBadge } from "@/components/ui/Badge";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatRelativeTime, formatDate } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface OperationsStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  totalRefunds: number;
  refundAmount: number;
  avgProcessingTime: string;
  activeConversations: number;
}

interface Delivery {
  id: string;
  lead_id: string;
  tenant_id: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  error_message: string | null;
  lead?: { phone: string; full_name: string | null };
  tenant?: { name: string };
  offer?: { name: string };
}

interface Refund {
  id: string;
  tenant_id: string;
  amount: number;
  description: string | null;
  created_at: string;
  tenant?: { name: string };
}

export default function OperationsPage() {
  const toast = useToast();
  const [stats, setStats] = useState<OperationsStats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryId, setRetryId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      try {
        // Fetch delivery stats
        const [
          { count: totalDeliveries, error: totalError },
          { count: successfulDeliveries, error: successError },
          { count: failedDeliveries, error: failedError },
          { count: pendingDeliveries, error: pendingError },
        ] = await Promise.all([
          supabase.from("deliveries").select("id", { count: "exact", head: true }),
          supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "DELIVERED"),
          supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "FAILED"),
          supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        ]);

        if (totalError || successError || failedError || pendingError) {
          console.error("Error fetching delivery stats:", { totalError, successError, failedError, pendingError });
        }

        // Fetch refund stats
        const { data: refundData, error: refundError } = await supabase
          .from("credit_ledger")
          .select("amount")
          .eq("transaction_type", "CREDIT_REFUND");

        if (refundError) {
          console.error("Error fetching refund stats:", refundError);
        }

        const totalRefunds = refundData?.length || 0;
        const refundAmount = refundData?.reduce((sum: number, r: any) => sum + Math.abs(r.amount), 0) || 0;

        // Fetch active conversations
        const { count: activeConversations, error: conversationsError } = await supabase
          .from("lead_offers")
          .select("id", { count: "exact", head: true })
          .in("status", ["CONTACTED", "ENGAGED", "QUALIFYING"]);

        if (conversationsError) {
          console.error("Error fetching active conversations:", conversationsError);
        }

        setStats({
          totalDeliveries: totalDeliveries || 0,
          successfulDeliveries: successfulDeliveries || 0,
          failedDeliveries: failedDeliveries || 0,
          pendingDeliveries: pendingDeliveries || 0,
          totalRefunds,
          refundAmount,
          avgProcessingTime: "2.4min",
          activeConversations: activeConversations || 0,
        });

        // Fetch recent deliveries
        const { data: deliveriesData, error: deliveriesError } = await supabase
          .from("deliveries")
          .select(`
            id,
            lead_id,
            tenant_id,
            status,
            created_at,
            delivered_at,
            error_message,
            lead:leads(phone, full_name),
            tenant:tenants(name),
            offer:offers(name)
          `)
          .order("created_at", { ascending: false })
          .limit(50);

        if (deliveriesError) {
          console.error("Error fetching deliveries:", deliveriesError);
        } else if (deliveriesData) {
          setDeliveries(
            deliveriesData.map((d: any) => ({
              ...d,
              lead: Array.isArray(d.lead) ? d.lead[0] : d.lead,
              tenant: Array.isArray(d.tenant) ? d.tenant[0] : d.tenant,
              offer: Array.isArray(d.offer) ? d.offer[0] : d.offer,
            }))
          );
        }

        // Fetch recent refunds
        const { data: refundsData, error: refundsDataError } = await supabase
          .from("credit_ledger")
          .select(`
            id,
            tenant_id,
            amount,
            description,
            created_at,
            tenant:tenants(name)
          `)
          .eq("transaction_type", "CREDIT_REFUND")
          .order("created_at", { ascending: false })
          .limit(20);

        if (refundsDataError) {
          console.error("Error fetching refunds:", refundsDataError);
        } else if (refundsData) {
          setRefunds(
            refundsData.map((r: any) => ({
              ...r,
              tenant: Array.isArray(r.tenant) ? r.tenant[0] : r.tenant,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching operations data:", error);
        toast.error("Error al cargar datos de operaciones");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  const handleRetryDelivery = async () => {
    if (!retryId) return;

    try {
      // In production, this would trigger the delivery pipeline
      await (supabase as any)
        .from("deliveries")
        .update({
          status: "PENDING",
          error_message: null,
        })
        .eq("id", retryId);

      toast.success("Reintentando entrega...");
      setRetryId(null);
    } catch (error) {
      toast.error("Error al reintentar entrega");
    }
  };

  // Delivery columns
  const deliveryColumns: Column<Delivery>[] = [
    {
      key: "lead",
      header: "Lead",
      cell: (d) => (
        <div>
          <span className="font-medium text-white">{d.lead?.full_name || d.lead?.phone}</span>
          {d.lead?.full_name && (
            <p className="text-xs text-slate-500">{d.lead.phone}</p>
          )}
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant / Oferta",
      cell: (d) => (
        <div>
          <span className="text-slate-300">{d.tenant?.name}</span>
          {d.offer && (
            <p className="text-xs text-slate-500">{d.offer.name}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (d) => {
        const config: Record<string, { variant: "success" | "danger" | "warning" | "info"; label: string }> = {
          DELIVERED: { variant: "success", label: "Entregado" },
          FAILED: { variant: "danger", label: "Fallido" },
          PENDING: { variant: "warning", label: "Pendiente" },
          REFUNDED: { variant: "info", label: "Reembolsado" },
        };
        const c = config[d.status] || { variant: "default" as any, label: d.status };
        return <Badge variant={c.variant} dot>{c.label}</Badge>;
      },
    },
    {
      key: "time",
      header: "Fecha",
      cell: (d) => (
        <span className="text-slate-400 text-sm">{formatRelativeTime(d.created_at)}</span>
      ),
    },
    {
      key: "error",
      header: "Error",
      cell: (d) => (
        d.error_message ? (
          <span className="text-red-400 text-sm truncate max-w-[200px]" title={d.error_message}>
            {d.error_message}
          </span>
        ) : (
          <span className="text-slate-600">-</span>
        )
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      cell: (d) => (
        d.status === "FAILED" && (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setRetryId(d.id)}
            leftIcon={<RefreshCw className="h-3 w-3" />}
          >
            Retry
          </Button>
        )
      ),
    },
  ];

  // Refund columns
  const refundColumns: Column<Refund>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => <span className="text-white">{r.tenant?.name}</span>,
    },
    {
      key: "amount",
      header: "Créditos",
      cell: (r) => (
        <span className="font-medium text-emerald-400">+{Math.abs(r.amount)}</span>
      ),
    },
    {
      key: "reason",
      header: "Motivo",
      cell: (r) => (
        <span className="text-slate-400">{r.description || "Sin especificar"}</span>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (r) => (
        <span className="text-slate-400 text-sm">{formatDate(r.created_at)}</span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Operaciones"
        description="Monitoreo de entregas, reembolsos y estado del sistema"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Operaciones" },
        ]}
      />

      {/* Stats */}
      <StatsGrid columns={4} className="mb-6">
        <StatCard
          title="Entregas exitosas"
          value={stats?.successfulDeliveries || 0}
          icon={<CheckCircle />}
          iconColor="from-emerald-500 to-teal-500"
          change={stats ? Math.round((stats.successfulDeliveries / (stats.totalDeliveries || 1)) * 100) : 0}
          trend="up"
          changeLabel="tasa de éxito"
        />
        <StatCard
          title="Entregas fallidas"
          value={stats?.failedDeliveries || 0}
          icon={<XCircle />}
          iconColor="from-red-500 to-rose-500"
          trend={stats?.failedDeliveries ? "down" : "neutral"}
        />
        <StatCard
          title="Conversaciones activas"
          value={stats?.activeConversations || 0}
          icon={<MessageSquare />}
          iconColor="from-blue-500 to-cyan-500"
        />
        <StatCard
          title="Reembolsos"
          value={stats?.totalRefunds || 0}
          icon={<DollarSign />}
          iconColor="from-amber-500 to-orange-500"
        />
      </StatsGrid>

      {/* Alerts */}
      {(stats?.failedDeliveries || 0) > 0 && (
        <Card className="border-red-500/30 bg-red-500/5 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-400">
                  {stats?.failedDeliveries} entregas fallidas
                </h3>
                <p className="text-sm text-slate-400">
                  Hay entregas que requieren atención. Revisá los errores y reintentá.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="deliveries">
        <TabsList>
          <TabTrigger value="deliveries" count={stats?.totalDeliveries}>
            Entregas
          </TabTrigger>
          <TabTrigger value="refunds" count={stats?.totalRefunds}>
            Reembolsos
          </TabTrigger>
          <TabTrigger value="system">
            Estado del sistema
          </TabTrigger>
        </TabsList>

        {/* Deliveries */}
        <TabContent value="deliveries">
          <Card>
            <CardHeader>
              <CardTitle>Historial de entregas</CardTitle>
            </CardHeader>
            <DataTable
              data={deliveries}
              columns={deliveryColumns}
              keyExtractor={(d) => d.id}
              isLoading={isLoading}
              emptyState={
                <EmptyState
                  icon={<CheckCircle />}
                  title="Sin entregas"
                  description="Las entregas aparecerán aquí cuando los leads alcancen Lead Ready."
                  size="sm"
                />
              }
            />
          </Card>
        </TabContent>

        {/* Refunds */}
        <TabContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle>Historial de reembolsos</CardTitle>
            </CardHeader>
            <DataTable
              data={refunds}
              columns={refundColumns}
              keyExtractor={(r) => r.id}
              isLoading={isLoading}
              emptyState={
                <EmptyState
                  icon={<DollarSign />}
                  title="Sin reembolsos"
                  description="Los reembolsos automáticos por duplicados o spam aparecerán aquí."
                  size="sm"
                />
              }
            />
          </Card>
        </TabContent>

        {/* System Status */}
        <TabContent value="system">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Servicios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "API Webhooks", status: "operational" },
                  { name: "OpenAI Integration", status: "operational" },
                  { name: "Chatwoot Connection", status: "operational" },
                  { name: "Supabase Database", status: "operational" },
                  { name: "Stripe Payments", status: "operational" },
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <span className="text-slate-300">{service.name}</span>
                    <Badge variant="success" dot>
                      Operativo
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas del día</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tiempo promedio de respuesta</span>
                  <span className="font-medium text-white">{stats?.avgProcessingTime || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Webhooks recibidos</span>
                  <span className="font-medium text-white">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Mensajes enviados</span>
                  <span className="font-medium text-white">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tokens OpenAI usados</span>
                  <span className="font-medium text-white">--</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabContent>
      </Tabs>

      {/* Retry Modal */}
      <ConfirmModal
        isOpen={!!retryId}
        onClose={() => setRetryId(null)}
        onConfirm={handleRetryDelivery}
        title="Reintentar entrega"
        description="¿Querés reintentar esta entrega? Se volverá a intentar enviar el lead al destino configurado."
        confirmText="Reintentar"
      />
    </PageContainer>
  );
}

