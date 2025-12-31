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
  Calendar,
  Building2,
  Package,
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
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface RevenueMetrics {
  total_spend: number;
  total_revenue: number;
  total_profit: number;
  total_leads_raw: number;
  total_leads_ready: number;
  total_leads_delivered: number;
  avg_cpl_ready: number;
  avg_margin_pct: number;
}

interface TenantRevenue {
  tenant_id: string;
  tenant_name: string;
  platform_spend: number;
  revenue: number;
  profit: number;
  leads_raw: number;
  leads_ready: number;
  leads_delivered: number;
  cpl_ready: number;
  margin_pct: number;
  cost_per_lead: number;
}

interface OfferRevenue {
  offer_id: string;
  offer_name: string;
  tenant_name: string;
  platform_spend: number;
  revenue: number;
  profit: number;
  leads_raw: number;
  leads_ready: number;
  leads_delivered: number;
  cpl_ready: number;
  margin_pct: number;
}

export default function RevenueDashboardPage() {
  const toast = useToast();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [tenantRevenue, setTenantRevenue] = useState<TenantRevenue[]>([]);
  const [offerRevenue, setOfferRevenue] = useState<OfferRevenue[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch company summary
      const { data: summaryData, error: summaryError } = await supabase
        .from("company_revenue_summary")
        .select("*")
        .single();

      if (summaryError && summaryError.code !== "PGRST116") {
        console.error("Error fetching summary:", summaryError);
      }

      if (summaryData) {
        setMetrics({
          total_spend: parseFloat(summaryData.total_spend) || 0,
          total_revenue: parseFloat(summaryData.total_revenue) || 0,
          total_profit: parseFloat(summaryData.total_profit) || 0,
          total_leads_raw: parseInt(summaryData.total_leads_raw) || 0,
          total_leads_ready: parseInt(summaryData.total_leads_ready) || 0,
          total_leads_delivered: parseInt(summaryData.total_leads_delivered) || 0,
          avg_cpl_ready: parseFloat(summaryData.avg_cpl_ready) || 0,
          avg_margin_pct: parseFloat(summaryData.avg_margin_pct) || 0,
        });
      }

      // Fetch revenue by tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from("revenue_analytics")
        .select("*")
        .not("tenant_id", "is", null)
        .order("revenue", { ascending: false });

      if (tenantError) {
        console.error("Error fetching tenant revenue:", tenantError);
      }

      // Aggregate by tenant
      const tenantMap = new Map<string, TenantRevenue>();
      (tenantData || []).forEach((row: any) => {
        const existing = tenantMap.get(row.tenant_id);
        if (existing) {
          existing.platform_spend += parseFloat(row.platform_spend) || 0;
          existing.revenue += parseFloat(row.revenue) || 0;
          existing.profit += parseFloat(row.profit) || 0;
          existing.leads_raw += parseInt(row.leads_raw) || 0;
          existing.leads_ready += parseInt(row.leads_ready) || 0;
          existing.leads_delivered += parseInt(row.leads_delivered) || 0;
        } else {
          tenantMap.set(row.tenant_id, {
            tenant_id: row.tenant_id,
            tenant_name: row.tenant_name || "Unknown",
            platform_spend: parseFloat(row.platform_spend) || 0,
            revenue: parseFloat(row.revenue) || 0,
            profit: parseFloat(row.profit) || 0,
            leads_raw: parseInt(row.leads_raw) || 0,
            leads_ready: parseInt(row.leads_ready) || 0,
            leads_delivered: parseInt(row.leads_delivered) || 0,
            cpl_ready: parseFloat(row.cpl_ready) || 0,
            margin_pct: parseFloat(row.margin_pct) || 0,
            cost_per_lead: parseFloat(row.cost_per_lead) || 0,
          });
        }
      });

      // Recalculate aggregated metrics
      const tenants = Array.from(tenantMap.values()).map((t) => ({
        ...t,
        cpl_ready: t.leads_ready > 0 ? t.platform_spend / t.leads_ready : 0,
        margin_pct: t.revenue > 0 ? ((t.revenue - t.platform_spend) / t.revenue) * 100 : 0,
      }));

      setTenantRevenue(tenants);

      // Fetch revenue by offer
      const offers = (tenantData || [])
        .filter((row: any) => row.offer_id)
        .map((row: any) => ({
          offer_id: row.offer_id,
          offer_name: row.offer_name || "Unknown",
          tenant_name: row.tenant_name || "Unknown",
          platform_spend: parseFloat(row.platform_spend) || 0,
          revenue: parseFloat(row.revenue) || 0,
          profit: parseFloat(row.profit) || 0,
          leads_raw: parseInt(row.leads_raw) || 0,
          leads_ready: parseInt(row.leads_ready) || 0,
          leads_delivered: parseInt(row.leads_delivered) || 0,
          cpl_ready: parseFloat(row.cpl_ready) || 0,
          margin_pct: parseFloat(row.margin_pct) || 0,
        }));

      setOfferRevenue(offers);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
      toast.error("Error al cargar datos de revenue");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      key: "platform_spend",
      header: "Gasto Ads",
      cell: (row) => (
        <span className="text-red-400">{formatCurrency(row.platform_spend, "USD")}</span>
      ),
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (row) => (
        <span className="text-green-400">{formatCurrency(row.revenue, "USD")}</span>
      ),
    },
    {
      key: "profit",
      header: "Profit",
      cell: (row) => (
        <span className={row.profit >= 0 ? "text-green-400" : "text-red-400"}>
          {formatCurrency(row.profit, "USD")}
        </span>
      ),
    },
    {
      key: "leads_ready",
      header: "Leads Ready",
      cell: (row) => row.leads_ready,
    },
    {
      key: "cpl_ready",
      header: "CPL Ready",
      cell: (row) => formatCurrency(row.cpl_ready, "USD"),
    },
    {
      key: "cost_per_lead",
      header: "Precio CPL",
      cell: (row) => formatCurrency(row.cost_per_lead, "USD"),
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
      key: "platform_spend",
      header: "Gasto Ads",
      cell: (row) => (
        <span className="text-red-400">{formatCurrency(row.platform_spend, "USD")}</span>
      ),
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (row) => (
        <span className="text-green-400">{formatCurrency(row.revenue, "USD")}</span>
      ),
    },
    {
      key: "profit",
      header: "Profit",
      cell: (row) => (
        <span className={row.profit >= 0 ? "text-green-400" : "text-red-400"}>
          {formatCurrency(row.profit, "USD")}
        </span>
      ),
    },
    {
      key: "leads_raw",
      header: "Leads Raw",
      cell: (row) => row.leads_raw,
    },
    {
      key: "leads_ready",
      header: "Leads Ready",
      cell: (row) => row.leads_ready,
    },
    {
      key: "cpl_ready",
      header: "CPL Ready",
      cell: (row) => formatCurrency(row.cpl_ready, "USD"),
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
        description="Análisis de costos, revenue y profit por tenant y oferta"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Revenue" },
        ]}
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchData}
            isLoading={isLoading}
          >
            Actualizar
          </Button>
        }
      />

      {/* Summary Stats */}
      {isLoading ? (
        <StatsGrid columns={4} className="mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </StatsGrid>
      ) : metrics ? (
        <StatsGrid columns={4} className="mb-6">
          <StatCard
            title="Gasto en Ads"
            value={formatCurrency(metrics.total_spend, "USD")}
            icon={<TrendingDown />}
            iconColor="from-red-500 to-rose-600"
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(metrics.total_revenue, "USD")}
            icon={<DollarSign />}
            iconColor="from-green-500 to-emerald-600"
          />
          <StatCard
            title="Profit"
            value={formatCurrency(metrics.total_profit, "USD")}
            icon={<TrendingUp />}
            iconColor={metrics.total_profit >= 0 ? "from-blue-500 to-cyan-600" : "from-red-500 to-rose-600"}
          />
          <StatCard
            title="CPL Ready (Promedio)"
            value={formatCurrency(metrics.avg_cpl_ready, "USD")}
            icon={<Target />}
            iconColor="from-purple-500 to-pink-600"
          />
        </StatsGrid>
      ) : null}

      {/* Additional Stats Row */}
      {metrics && (
        <StatsGrid columns={4} className="mb-6">
          <StatCard
            title="Leads Raw"
            value={metrics.total_leads_raw}
            icon={<Users />}
            iconColor="from-slate-500 to-slate-600"
          />
          <StatCard
            title="Leads Ready"
            value={metrics.total_leads_ready}
            icon={<Users />}
            iconColor="from-amber-500 to-orange-600"
          />
          <StatCard
            title="Leads Entregados"
            value={metrics.total_leads_delivered}
            icon={<Users />}
            iconColor="from-green-500 to-emerald-600"
          />
          <StatCard
            title="Margen Promedio"
            value={`${metrics.avg_margin_pct.toFixed(1)}%`}
            icon={<BarChart3 />}
            iconColor={metrics.avg_margin_pct >= 30 ? "from-green-500 to-emerald-600" : "from-amber-500 to-orange-600"}
          />
        </StatsGrid>
      )}

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
                  description="Conectá Meta Ads y sincronizá los costos para ver el análisis de revenue."
                />
              ) : (
                <DataTable
                  data={tenantRevenue}
                  columns={tenantColumns}
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
                  description="Conectá Meta Ads y sincronizá los costos para ver el análisis de revenue por oferta."
                />
              ) : (
                <DataTable
                  data={offerRevenue}
                  columns={offerColumns}
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

