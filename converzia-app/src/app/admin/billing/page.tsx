"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Download,
  Building2,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BillingStats } from "@/components/admin/BillingStats";
import { Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveList } from "@/components/ui/ResponsiveList";
import { MobileCard, MobileCardAvatar } from "@/components/ui/MobileCard";
import { QuickFilters } from "@/components/ui/FilterDrawer";
import { useBillingAdmin } from "@/lib/hooks/use-billing-admin";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function BillingPage() {
  const router = useRouter();
  const { stats, orders, isLoading, error, refetch } = useBillingAdmin();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !search ||
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      order.tenant?.name?.toLowerCase().includes(search.toLowerCase()) ||
      order.package_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const orderColumns: Column<typeof orders[0]>[] = [
    {
      key: "order",
      header: "Orden",
      cell: (order) => (
        <div>
          <span className="font-medium text-[var(--text-primary)]">{order.order_number}</span>
          {order.package_name && (
            <p className="text-sm text-[var(--text-tertiary)]">{order.package_name}</p>
          )}
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (order) => (
        <span className="text-[var(--text-secondary)]">{order.tenant?.name || "N/A"}</span>
      ),
    },
    {
      key: "credits",
      header: "Créditos",
      cell: (order) => (
        <span className="text-[var(--text-primary)] font-medium">{order.credits_purchased}</span>
      ),
    },
    {
      key: "amount",
      header: "Monto",
      cell: (order) => (
        <span className="text-[var(--text-primary)] font-semibold">
          {formatCurrency(Number(order.total), order.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (order) => {
        const statusConfig: Record<string, { variant: "success" | "warning" | "danger" | "default"; label: string }> = {
          completed: { variant: "success", label: "Completado" },
          pending: { variant: "warning", label: "Pendiente" },
          failed: { variant: "danger", label: "Fallido" },
          refunded: { variant: "default", label: "Reembolsado" },
        };
        const config = statusConfig[order.status] || { variant: "default" as any, label: order.status };
        return <Badge variant={config.variant} dot>{config.label}</Badge>;
      },
    },
    {
      key: "date",
      header: "Fecha",
      cell: (order) => (
        <span className="text-[var(--text-tertiary)] text-sm">
          {order.paid_at ? formatDate(order.paid_at) : formatDate(order.created_at)}
        </span>
      ),
    },
  ];

  const handleExport = () => {
    const csvData = filteredOrders.map((o) => ({
      Orden: o.order_number,
      Tenant: o.tenant?.name || "",
      Créditos: o.credits_purchased,
      Monto: o.total,
      Estado: o.status,
      Fecha: o.paid_at || o.created_at,
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // No bloqueo completo - siempre mostrar estructura

  return (
    <PageContainer>
      <PageHeader
        title="Facturación"
        description="Gestiona facturación y pagos de tenants"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Facturación" },
        ]}
        actions={
          <Button
            variant="secondary"
            onClick={handleExport}
            leftIcon={<Download className="h-4 w-4" />}
            disabled={filteredOrders.length === 0}
          >
            Exportar
          </Button>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-[var(--error-light)] border border-[var(--error)]/20 rounded-lg text-[var(--error)]">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      ) : stats ? (
        <div className="mb-6">
          <BillingStats
            totalRevenue={stats.totalRevenue}
            creditsSold={stats.creditsSold}
            activeTenants={stats.activeTenants}
            pendingPayments={stats.pendingPayments}
            revenueThisMonth={stats.revenueThisMonth}
            revenueLastMonth={stats.revenueLastMonth}
            revenueTrend={stats.revenueTrend}
          />
        </div>
      ) : null}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Órdenes</CardTitle>
        </CardHeader>
        <CardContent noPadding>
          {/* Filters */}
          <div className="p-4 border-b border-[var(--border-primary)]">
            {isMobile ? (
              <div className="space-y-3">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar orden..."
                  className="w-full"
                />
                <QuickFilters
                  filters={[
                    { key: "", label: "Todos" },
                    { key: "completed", label: "Completados" },
                    { key: "pending", label: "Pendientes" },
                    { key: "failed", label: "Fallidos" },
                  ]}
                  activeFilter={statusFilter}
                  onFilterChange={setStatusFilter}
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar por orden, tenant o paquete..."
                  className="flex-1 max-w-md"
                />
                <div className="flex items-center gap-2">
                  {[
                    { value: "", label: "Todos" },
                    { value: "completed", label: "Completados" },
                    { value: "pending", label: "Pendientes" },
                    { value: "failed", label: "Fallidos" },
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setStatusFilter(status.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        statusFilter === status.value
                          ? "bg-[var(--accent-primary)] text-white"
                          : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={isMobile ? "p-4" : ""}>
            <ResponsiveList
              data={filteredOrders}
              columns={orderColumns}
              keyExtractor={(o) => o.id}
              isLoading={isLoading}
              renderMobileItem={(order) => {
                const statusConfig: Record<string, { variant: "success" | "warning" | "danger" | "default"; label: string }> = {
                  completed: { variant: "success", label: "Completado" },
                  pending: { variant: "warning", label: "Pendiente" },
                  failed: { variant: "danger", label: "Fallido" },
                  refunded: { variant: "default", label: "Reembolsado" },
                };
                const config = statusConfig[order.status] || { variant: "default" as const, label: order.status };
                
                return (
                  <MobileCard
                    avatar={<MobileCardAvatar variant="primary" icon={CreditCard} />}
                    title={order.order_number}
                    subtitle={order.tenant?.name || "N/A"}
                    badges={<Badge variant={config.variant} dot>{config.label}</Badge>}
                    stats={[
                      { icon: CreditCard, value: order.credits_purchased, label: "Créditos" },
                    ]}
                    rightContent={
                      <span className="font-semibold text-foreground">
                        {formatCurrency(Number(order.total), order.currency)}
                      </span>
                    }
                    metadata={order.paid_at ? formatDate(order.paid_at) : formatDate(order.created_at)}
                    showChevron={false}
                  />
                );
              }}
              emptyState={
                <EmptyState
                  icon={<CreditCard />}
                  title="Sin órdenes"
                  description="No hay órdenes todavía."
                  size="sm"
                />
              }
            />
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
