"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  Sparkles,
  Filter,
  Download,
  Package,
  RefreshCw,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Column } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectDropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { usePortalOffers } from "@/lib/hooks/use-portal";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { CreditPackage } from "@/types";

interface ConsumptionRecord {
  ledger_id: string;
  tenant_id: string;
  offer_id: string | null;
  amount: number;
  balance_after: number;
  entry_type: string;
  description: string | null;
  created_at: string;
  lead_display_name: string | null;
  offer_name: string | null;
  lead_status: string | null;
}

export default function PortalBillingPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const toast = useToast();
  const { offers } = usePortalOffers();
  
  const [balance, setBalance] = useState(0);
  const [summary, setSummary] = useState({ totalPurchased: 0, totalConsumed: 0, totalRefunded: 0 });
  const [transactions, setTransactions] = useState<ConsumptionRecord[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  
  // Filters
  const [filterOffer, setFilterOffer] = useState<string>("");
  
  const supabase = createClient();

  // Fetch billing data
  useEffect(() => {
    async function fetchBillingData() {
      if (!activeTenantId) return;
      setIsLoading(true);

      try {
        // Fetch consumption data from API
        const params = new URLSearchParams();
        if (filterOffer) params.set("offer_id", filterOffer);
        
        const response = await fetch(`/api/portal/billing/consumption?${params}`);
        const result = await response.json();
        
        if (result.success) {
          setBalance(result.data.balance);
          setSummary(result.data.summary);
          setTransactions(result.data.transactions);
        }

        // Fetch packages
        const { data: pricingData } = await queryWithTimeout(
          supabase
            .from("tenant_pricing")
            .select("packages")
            .eq("tenant_id", activeTenantId)
            .single(),
          10000,
          "fetch packages"
        );

        if ((pricingData as any)?.packages) {
          setPackages((pricingData as any).packages as CreditPackage[]);
        }
      } catch (error) {
        console.error("Error loading billing:", error);
        toast.error("Error al cargar datos de facturación");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBillingData();
  }, [supabase, activeTenantId, filterOffer]);

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!hasPermission?.("billing:manage")) {
      toast.error("No tenés permisos para realizar compras");
      return;
    }

    setLoadingCheckout(pkg.id);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: activeTenantId,
          package_id: pkg.id,
          credits: pkg.credits,
          price: pkg.price,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error("Error al iniciar el checkout");
    } finally {
      setLoadingCheckout(null);
    }
  };

  // Transaction columns
  const txColumns: Column<ConsumptionRecord>[] = [
    {
      key: "type",
      header: "Tipo",
      cell: (tx) => {
        const config: Record<string, { icon: React.ElementType; color: string; label: string }> = {
          CREDIT_PURCHASE: { icon: TrendingUp, color: "text-emerald-400", label: "Compra" },
          CREDIT_CONSUMPTION: { icon: TrendingDown, color: "text-red-400", label: "Lead entregado" },
          CREDIT_REFUND: { icon: RefreshCw, color: "text-blue-400", label: "Reembolso" },
          CREDIT_ADJUSTMENT: { icon: CreditCard, color: "text-amber-400", label: "Ajuste" },
          CREDIT_BONUS: { icon: Sparkles, color: "text-purple-400", label: "Bonus" },
        };
        const c = config[tx.entry_type] || { icon: CreditCard, color: "text-slate-400", label: tx.entry_type };
        const Icon = c.icon;

        return (
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center`}>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <span className="text-slate-300">{c.label}</span>
          </div>
        );
      },
    },
    {
      key: "details",
      header: "Detalle",
      cell: (tx) => (
        <div>
          {tx.lead_display_name && (
            <p className="text-sm text-white">{tx.lead_display_name}</p>
          )}
          {tx.offer_name && (
            <p className="text-xs text-slate-500">{tx.offer_name}</p>
          )}
          {!tx.lead_display_name && tx.description && (
            <p className="text-sm text-slate-400">{tx.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Créditos",
      cell: (tx) => (
        <span className={tx.amount >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
          {tx.amount >= 0 ? "+" : ""}{tx.amount}
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      cell: (tx) => (
        <span className="text-slate-400">{tx.balance_after}</span>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (tx) => (
        <span className="text-slate-400 text-sm">{formatRelativeTime(tx.created_at)}</span>
      ),
    },
  ];

  const canManageBilling = hasPermission?.("billing:manage");

  // Offer filter options
  const offerOptions = [
    { value: "", label: "Todos los proyectos" },
    ...offers.map(o => ({ value: o.id, label: o.name })),
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Facturación"
        description="Balance de créditos y consumo"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Current Balance - Featured */}
        <Card className="md:col-span-2 bg-gradient-to-r from-primary-500/20 to-accent-500/20 border-primary-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 mb-1">Balance actual</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">{balance}</span>
                  <span className="text-slate-400">créditos</span>
                </div>
                {balance < 10 && balance >= 0 && (
                  <p className="text-amber-400 text-sm mt-2 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Créditos bajos - recargá para seguir recibiendo leads
                  </p>
                )}
              </div>
              <div className="h-16 w-16 rounded-2xl bg-primary-500/20 flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-primary-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total comprado</p>
                <p className="text-xl font-semibold text-white">{summary.totalPurchased}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total consumido</p>
                <p className="text-xl font-semibold text-white">{summary.totalConsumed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Packages */}
      {canManageBilling && packages.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recargar créditos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className={pkg.is_popular ? "border-primary-500/50 relative" : ""}
              >
                {pkg.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="primary">Recomendado</Badge>
                  </div>
                )}
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                  <div className="flex items-baseline justify-center gap-1 mb-1">
                    <span className="text-3xl font-bold text-white">{pkg.credits}</span>
                    <span className="text-slate-400">créditos</span>
                  </div>
                  <p className="text-2xl font-semibold text-primary-400 mb-4">
                    {formatCurrency(pkg.price)}
                  </p>
                  {pkg.discount_pct && (
                    <p className="text-emerald-400 text-sm mb-4">
                      {pkg.discount_pct}% de ahorro
                    </p>
                  )}
                  <Button
                    fullWidth
                    variant={pkg.is_popular ? "primary" : "secondary"}
                    onClick={() => handlePurchase(pkg)}
                    isLoading={loadingCheckout === pkg.id}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Comprar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historial de consumo</CardTitle>
            <div className="flex items-center gap-3">
              {offers.length > 1 && (
                <div className="w-48">
                  <SelectDropdown
                    value={filterOffer}
                    onChange={setFilterOffer}
                    options={offerOptions}
                    placeholder="Filtrar por proyecto"
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <DataTable
          data={transactions}
          columns={txColumns}
          keyExtractor={(tx) => tx.ledger_id}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={<CreditCard />}
              title="Sin movimientos"
              description="El historial de consumo de créditos aparecerá aquí."
              size="sm"
            />
          }
        />
      </Card>
    </PageContainer>
  );
}
