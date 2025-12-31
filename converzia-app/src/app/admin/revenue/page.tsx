"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Target,
  RefreshCw,
  Building2,
  Package,
  CreditCard,
  Wallet,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { DataTable, Column } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { DateRangePicker, DateRange, DatePresetId, DEFAULT_DATE_PRESETS } from "@/components/ui/DatePicker";
import { formatCurrency } from "@/lib/utils";

interface RevenueSummary {
  payments_received: number;
  leads_ready_count: number;
  leads_ready_value: number;
  leads_delivered_count: number;
  leads_delivered_value: number;
  attributed_spend: number;
  platform_spend: number;
  leads_raw_count: number;
  profit: number;
  margin_pct: number;
  pending_credits: number;
}

interface TenantRevenue {
  tenant_id: string;
  tenant_name: string;
  payments_received: number;
  leads_ready_count: number;
  leads_ready_value: number;
  leads_delivered_count: number;
  leads_delivered_value: number;
  attributed_spend: number;
  platform_spend: number;
  leads_raw_count: number;
  profit: number;
  margin_pct: number;
  cost_per_lead: number;
  cpl_attributed: number;
}

interface OfferRevenue {
  offer_id: string;
  offer_name: string;
  tenant_id: string;
  tenant_name: string;
  leads_ready_count: number;
  leads_ready_value: number;
  attributed_spend: number;
  profit: number;
  margin_pct: number;
}

export default function RevenueDashboardPage() {
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [tenantRevenue, setTenantRevenue] = useState<TenantRevenue[]>([]);
  const [offerRevenue, setOfferRevenue] = useState<OfferRevenue[]>([]);
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [selectedPreset, setSelectedPreset] = useState<DatePresetId>("last_30_days");

  const fetchData = useCallback(async (refresh = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (dateRange.from) {
        params.set("date_start", dateRange.from.toISOString().split("T")[0]);
      }
      if (dateRange.to) {
        params.set("date_end", dateRange.to.toISOString().split("T")[0]);
      }
      if (refresh) {
        params.set("refresh", "true");
      }

      const response = await fetch(`/api/admin/revenue?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error fetching revenue data");
      }

      setSummary(result.summary);
      setTenantRevenue(result.by_tenant || []);
      setOfferRevenue(result.by_offer || []);
    } catch (error: any) {
      console.error("Error fetching revenue data:", error);
      toast.error(error.message || "Error al cargar datos de revenue");
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateRangeChange = (range: DateRange, presetId?: DatePresetId) => {
    setDateRange(range);
    if (presetId) {
      setSelectedPreset(presetId);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  const tenantColumns: Column<TenantRevenue>[] = [
    {
      key: "tenant_name",
      header: "Tenant",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xs font-medium">
            {row.tenant_name.substring(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-[var(--text-primary)]">
            {row.tenant_name}
          </span>
        </div>
      ),
    },
    {
      key: "leads_ready_value",
      header: "Valor Generado",
      cell: (row) => (
        <span className="text-green-400 font-medium">
          {formatCurrency(row.leads_ready_value, "USD")}
        </span>
      ),
    },
    {
      key: "attributed_spend",
      header: "Gasto Atribuido",
      cell: (row) => (
        <span className="text-red-400">
          {formatCurrency(row.attributed_spend, "USD")}
        </span>
      ),
    },
    {
      key: "profit",
      header: "Profit",
      cell: (row) => (
        <span className={row.profit >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
          {formatCurrency(row.profit, "USD")}
        </span>
      ),
    },
    {
      key: "leads_ready_count",
      header: "Leads Ready",
      cell: (row) => (
        <span className="text-[var(--text-primary)]">{row.leads_ready_count}</span>
      ),
    },
    {
      key: "cpl_attributed",
      header: "CPL Atribuido",
      cell: (row) => (
        <span className="text-[var(--text-secondary)]">
          {formatCurrency(row.cpl_attributed, "USD")}
        </span>
      ),
    },
    {
      key: "cost_per_lead",
      header: "Precio CPL",
      cell: (row) => (
        <span className="text-[var(--text-primary)]">
          {formatCurrency(row.cost_per_lead, "USD")}
        </span>
      ),
    },
    {
      key: "margin_pct",
      header: "Margen",
      cell: (row) => (
        <Badge variant={row.margin_pct >= 30 ? "success" : row.margin_pct >= 0 ? "warning" : "error"}>
          {row.margin_pct.toFixed(1)}%
        </Badge>
      ),
    },
  ];

  const offerColumns: Column<OfferRevenue>[] = [
    {
      key: "offer_name",
      header: "Oferta",
      cell: (row) => (
        <div>
          <span className="font-medium text-[var(--text-primary)]">
            {row.offer_name}
          </span>
          <p className="text-xs text-[var(--text-tertiary)]">{row.tenant_name}</p>
        </div>
      ),
    },
    {
      key: "leads_ready_value",
      header: "Valor Generado",
      cell: (row) => (
        <span className="text-green-400 font-medium">
          {formatCurrency(row.leads_ready_value, "USD")}
        </span>
      ),
    },
    {
      key: "attributed_spend",
      header: "Gasto Atribuido",
      cell: (row) => (
        <span className="text-red-400">
          {formatCurrency(row.attributed_spend, "USD")}
        </span>
      ),
    },
    {
      key: "profit",
      header: "Profit",
      cell: (row) => (
        <span className={row.profit >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
          {formatCurrency(row.profit, "USD")}
        </span>
      ),
    },
    {
      key: "leads_ready_count",
      header: "Leads Ready",
      cell: (row) => row.leads_ready_count,
    },
    {
      key: "margin_pct",
      header: "Margen",
      cell: (row) => (
        <Badge variant={row.margin_pct >= 30 ? "success" : row.margin_pct >= 0 ? "warning" : "error"}>
          {row.margin_pct.toFixed(1)}%
        </Badge>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Revenue Dashboard"
        description="Análisis de ingresos, costos atribuidos y profit por tenant y oferta"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Revenue" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              selectedPreset={selectedPreset}
              onPresetChange={setSelectedPreset}
              presets={DEFAULT_DATE_PRESETS}
              compact
            />
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={handleRefresh}
              isLoading={isLoading}
            >
              Actualizar
            </Button>
          </div>
        }
      />

      {/* Main Stats Row - Key Metrics */}
      {isLoading ? (
        <StatsGrid columns={4} className="mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </StatsGrid>
      ) : summary ? (
        <>
          <StatsGrid columns={4} className="mb-6">
            <StatCard
              title="Ingresos Recibidos"
              value={formatCurrency(summary.payments_received, "USD")}
              icon={<Wallet />}
              iconColor="from-emerald-500 to-green-600"
              tooltip="Pagos de tenants en el período"
            />
            <StatCard
              title="Valor Generado"
              value={formatCurrency(summary.leads_ready_value, "USD")}
              icon={<DollarSign />}
              iconColor="from-blue-500 to-cyan-600"
              tooltip="Leads ready × precio CPL"
            />
            <StatCard
              title="Profit Real"
              value={formatCurrency(summary.profit, "USD")}
              icon={<TrendingUp />}
              iconColor={summary.profit >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600"}
            />
            <StatCard
              title="Créditos Pendientes"
              value={summary.pending_credits.toLocaleString()}
              icon={<CreditCard />}
              iconColor="from-purple-500 to-pink-600"
            />
          </StatsGrid>

          {/* Secondary Stats Row */}
          <StatsGrid columns={4} className="mb-6">
            <StatCard
              title="Gasto en Ads (Total)"
              value={formatCurrency(summary.platform_spend, "USD")}
              icon={<TrendingDown />}
              iconColor="from-red-500 to-rose-600"
            />
            <StatCard
              title="Gasto Atribuido"
              value={formatCurrency(summary.attributed_spend, "USD")}
              icon={<Target />}
              iconColor="from-orange-500 to-amber-600"
              tooltip="Costo de ads proporcional a leads"
            />
            <StatCard
              title="Leads Ready"
              value={summary.leads_ready_count}
              icon={<Users />}
              iconColor="from-amber-500 to-orange-600"
            />
            <StatCard
              title="Margen Promedio"
              value={`${summary.margin_pct.toFixed(1)}%`}
              icon={<BarChart3 />}
              iconColor={summary.margin_pct >= 30 ? "from-green-500 to-emerald-600" : "from-amber-500 to-orange-600"}
            />
          </StatsGrid>
        </>
      ) : null}

      {/* Tabs for Tenant/Offer breakdown */}
      <Tabs defaultValue="tenants">
        <TabsList>
          <TabTrigger value="tenants" count={tenantRevenue.length}>
            <Building2 className="h-4 w-4 mr-2" />
            Por Tenant
          </TabTrigger>
          <TabTrigger value="offers" count={offerRevenue.length}>
            <Package className="h-4 w-4 mr-2" />
            Por Oferta
          </TabTrigger>
        </TabsList>

        <TabContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle>Revenue por Tenant</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : tenantRevenue.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-12 w-12" />}
                  title="Sin datos de revenue"
                  description="No hay datos de revenue para el período seleccionado."
                />
              ) : (
                <DataTable
                  data={tenantRevenue}
                  columns={tenantColumns}
                  keyExtractor={(row) => row.tenant_id}
                  stickyHeader
                />
              )}
            </CardContent>
          </Card>
        </TabContent>

        <TabContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle>Revenue por Oferta</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : offerRevenue.length === 0 ? (
                <EmptyState
                  icon={<Package className="h-12 w-12" />}
                  title="Sin datos de revenue"
                  description="No hay datos de revenue por oferta para el período seleccionado."
                />
              ) : (
                <DataTable
                  data={offerRevenue}
                  columns={offerColumns}
                  keyExtractor={(row) => row.offer_id}
                  stickyHeader
                />
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>
    </PageContainer>
  );
}
