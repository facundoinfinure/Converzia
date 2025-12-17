"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Package,
  Clock,
  CheckCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Column } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { usePortalBilling } from "@/lib/hooks/use-portal";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import type { CreditLedgerEntry, CreditPackage } from "@/types";

export default function PortalBillingPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const toast = useToast();
  const { balance, transactions, isLoading } = usePortalBilling();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch packages
  useEffect(() => {
    async function fetchPackages() {
      if (!activeTenantId) return;

      const { data } = await supabase
        .from("tenant_pricing")
        .select("packages")
        .eq("tenant_id", activeTenantId)
        .single();

      if ((data as any)?.packages) {
        setPackages((data as any).packages as CreditPackage[]);
      }
    }

    fetchPackages();
  }, [supabase, activeTenantId]);

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!hasPermission("billing:manage")) {
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

      // Redirect to Stripe Checkout
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
  const txColumns: Column<CreditLedgerEntry>[] = [
    {
      key: "type",
      header: "Tipo",
      cell: (tx) => {
        const config: Record<string, { icon: React.ElementType; color: string; label: string }> = {
          CREDIT_PURCHASE: { icon: TrendingUp, color: "text-emerald-400", label: "Compra" },
          CREDIT_CONSUMPTION: { icon: TrendingDown, color: "text-red-400", label: "Consumo" },
          CREDIT_REFUND: { icon: TrendingUp, color: "text-blue-400", label: "Reembolso" },
          CREDIT_ADJUSTMENT: { icon: CreditCard, color: "text-amber-400", label: "Ajuste" },
          CREDIT_BONUS: { icon: Sparkles, color: "text-purple-400", label: "Bonus" },
        };
        const c = config[tx.transaction_type] || { icon: CreditCard, color: "text-slate-400", label: tx.transaction_type };
        const Icon = c.icon;

        return (
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${c.color}`} />
            <span className="text-slate-300">{c.label}</span>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Créditos",
      cell: (tx) => (
        <span className={tx.amount >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
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
      key: "description",
      header: "Descripción",
      cell: (tx) => (
        <span className="text-slate-500">{tx.description || "-"}</span>
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

  const canManageBilling = hasPermission("billing:manage");

  return (
    <PageContainer>
      <PageHeader
        title="Billing"
        description="Gestiona tus créditos y compras"
      />

      {/* Current Balance */}
      <Card className="mb-6 bg-gradient-to-r from-primary-500/20 to-accent-500/20 border-primary-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 mb-1">Balance actual</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{balance}</span>
                <span className="text-slate-400">créditos</span>
              </div>
              {balance < 10 && (
                <p className="text-amber-400 text-sm mt-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Créditos bajos - recargá para seguir recibiendo leads
                </p>
              )}
            </div>
            <div className="h-20 w-20 rounded-2xl bg-primary-500/20 flex items-center justify-center">
              <CreditCard className="h-10 w-10 text-primary-400" />
            </div>
          </div>
        </CardContent>
      </Card>

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
                    <Badge variant="primary">Popular</Badge>
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
                      {pkg.discount_pct}% de descuento
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
          <CardTitle>Historial de transacciones</CardTitle>
        </CardHeader>
        <DataTable
          data={transactions}
          columns={txColumns}
          keyExtractor={(tx) => tx.id}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={<CreditCard />}
              title="Sin transacciones"
              description="Las transacciones de créditos aparecerán aquí."
              size="sm"
            />
          }
        />
      </Card>
    </PageContainer>
  );
}

