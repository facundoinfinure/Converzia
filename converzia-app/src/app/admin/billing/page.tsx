"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  Search,
  Download,
  Filter,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { LightCard, LightCardHeader, LightCardTitle, LightCardContent } from "@/components/ui/LightCard";
import { LightButton } from "@/components/ui/LightButton";
import { BillingStats } from "@/components/admin/BillingStats";
import { DataTable, Column } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBillingAdmin } from "@/lib/hooks/use-billing-admin";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function BillingPage() {
  const router = useRouter();
  const { stats, orders, isLoading, error, refetch } = useBillingAdmin();
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
          <span className="font-medium text-gray-900">{order.order_number}</span>
          {order.package_name && (
            <p className="text-sm text-gray-500">{order.package_name}</p>
          )}
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (order) => (
        <span className="text-gray-700">{order.tenant?.name || "N/A"}</span>
      ),
    },
    {
      key: "credits",
      header: "Créditos",
      cell: (order) => (
        <span className="text-gray-900 font-medium">{order.credits_purchased}</span>
      ),
    },
    {
      key: "amount",
      header: "Monto",
      cell: (order) => (
        <span className="text-gray-900 font-semibold">
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
        <span className="text-gray-500 text-sm">
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
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Billing"
        description="Gestiona facturación y pagos de tenants"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Billing" },
        ]}
        actions={
          <LightButton
            variant="secondary"
            onClick={handleExport}
            leftIcon={<Download className="h-4 w-4" />}
            disabled={filteredOrders.length === 0}
          >
            Exportar
          </LightButton>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {stats && (
        <BillingStats
          totalRevenue={stats.totalRevenue}
          creditsSold={stats.creditsSold}
          activeTenants={stats.activeTenants}
          pendingPayments={stats.pendingPayments}
          revenueThisMonth={stats.revenueThisMonth}
          revenueLastMonth={stats.revenueLastMonth}
          revenueTrend={stats.revenueTrend}
        />
      )}

      {/* Orders Table */}
      <LightCard>
        <LightCardHeader>
          <LightCardTitle>Historial de Órdenes</LightCardTitle>
        </LightCardHeader>
        <LightCardContent className="p-0">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200">
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
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      statusFilter === status.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DataTable
            data={filteredOrders}
            columns={orderColumns}
            keyExtractor={(o) => o.id}
            isLoading={isLoading}
            emptyState={
              <div className="px-6 py-12 text-center text-gray-500">
                No hay órdenes todavía.
              </div>
            }
          />
        </LightCardContent>
      </LightCard>
    </PageContainer>
  );
}

