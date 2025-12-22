"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Link2,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  Megaphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string | null; // null means not actionable by tenant
  icon: React.ElementType;
  isCompleted: boolean;
  isPending?: boolean; // Waiting on Converzia
}

interface OnboardingChecklistProps {
  tenantId: string;
}

export function OnboardingChecklist({ tenantId }: OnboardingChecklistProps) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    loadOnboardingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function loadOnboardingStatus() {
    setIsLoading(true);
    const supabase = createClient();

    // Check each onboarding milestone in parallel
    const [
      { count: adsCount },
      { count: integrationsCount },
      { data: creditsData },
    ] = await Promise.all([
      supabase
        .from("ad_offer_map")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      supabase
        .from("tenant_integrations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      supabase
        .from("tenant_credit_balance")
        .select("current_balance")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    const hasAds = (adsCount || 0) > 0;
    const hasIntegration = (integrationsCount || 0) > 0;
    const hasCredits = (creditsData?.current_balance || 0) > 0;

    // Only show tenant-actionable steps + status of Converzia-managed steps
    setSteps([
      {
        id: "integrations",
        title: "Configurar integraciones",
        description: "Conectá Google Sheets, Tokko o un webhook para recibir leads",
        href: "/portal/integrations",
        icon: Link2,
        isCompleted: hasIntegration,
      },
      {
        id: "credits",
        title: "Comprar créditos",
        description: "Adquirí créditos para que tus leads sean entregados",
        href: "/portal/billing",
        icon: CreditCard,
        isCompleted: hasCredits,
      },
      {
        id: "ads",
        title: "Anuncios mapeados",
        description: hasAds 
          ? "Tus anuncios de Meta están conectados" 
          : "Converzia está configurando tus anuncios",
        href: null, // Not actionable by tenant
        icon: hasAds ? Megaphone : Clock,
        isCompleted: hasAds,
        isPending: !hasAds,
      },
    ]);

    setIsLoading(false);
  }

  // Only count actionable steps for completion
  const actionableSteps = steps.filter((s) => s.href !== null);
  const completedActionable = actionableSteps.filter((s) => s.isCompleted).length;
  const totalActionable = actionableSteps.length;
  const isAllCompleted = completedActionable === totalActionable && totalActionable > 0;

  // Hide if dismissed or all completed (including pending Converzia steps)
  const allDone = steps.every((s) => s.isCompleted);
  if (isDismissed || allDone) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="mb-6 border-primary-500/30 bg-gradient-to-r from-primary-500/10 to-transparent">
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary-500/20" />
            <div className="flex-1">
              <div className="h-4 bg-slate-700 rounded w-48 mb-2" />
              <div className="h-3 bg-slate-700 rounded w-64" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-primary-500/30 bg-gradient-to-r from-primary-500/10 to-transparent">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <CardTitle>Configurá tu cuenta</CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">
                {completedActionable} de {totalActionable} pasos completados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissed(true)}
              className="text-xs text-slate-500 hover:text-slate-400"
            >
              Ocultar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
            style={{ width: `${totalActionable > 0 ? (completedActionable / totalActionable) * 100 : 0}%` }}
          />
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-4">
          <div className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              const content = (
                <>
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      step.isCompleted
                        ? "bg-emerald-500/20"
                        : step.isPending
                        ? "bg-amber-500/20"
                        : "bg-slate-700"
                    )}
                  >
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Icon className={cn(
                        "h-5 w-5",
                        step.isPending ? "text-amber-400" : "text-slate-400"
                      )} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-medium",
                        step.isCompleted 
                          ? "text-emerald-400" 
                          : step.isPending
                          ? "text-amber-400"
                          : "text-white"
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                      {step.description}
                    </p>
                  </div>
                  {!step.isCompleted && !step.isPending && step.href && (
                    <Button size="sm" variant="secondary" className="shrink-0">
                      Comenzar
                    </Button>
                  )}
                  {step.isPending && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded shrink-0">
                      En proceso
                    </span>
                  )}
                </>
              );

              // Non-actionable steps render as div, actionable as Link
              if (!step.href) {
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg",
                      step.isCompleted
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : step.isPending
                        ? "bg-amber-500/5 border border-amber-500/20"
                        : "bg-slate-800/50 border border-transparent"
                    )}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-colors",
                    step.isCompleted
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
                  )}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
