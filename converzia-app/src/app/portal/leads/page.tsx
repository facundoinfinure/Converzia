"use client";

import { useState, useEffect } from "react";
import {
  Users,
  UserCheck,
  MessageSquare,
  XCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  Filter,
  RefreshCw,
  Info,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Star,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard, StatsGrid } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Column } from "@/components/ui/Table";
import { CustomSelect } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveList } from "@/components/ui/ResponsiveList";
import { MobileCard, MobileCardAvatar } from "@/components/ui/MobileCard";
import { useAuth } from "@/lib/auth/context";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { createClient } from "@/lib/supabase/client";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { formatRelativeTime, cn } from "@/lib/utils";

// ============================================
// Types - Privacy-focused for tenants
// ============================================

interface TenantLeadStats {
  interested: number;        // ENGAGED, QUALIFYING
  inProgress: number;        // CONTACTED, SCORED
  ready: number;             // LEAD_READY, SENT_TO_DEVELOPER
  dropped: number;           // DISQUALIFIED, STOPPED, COOLING
}

// Simplified lead view for tenants - NO personal data for dropped leads
interface TenantLeadView {
  id: string;
  status: string;
  category: "interested" | "in_progress" | "ready" | "dropped";
  // Basic info - only shown for non-dropped leads
  firstName: string | null;  // Hidden for dropped leads
  offerName: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
  // For dropped leads - only show summary
  dropReason: string | null;
}

// Lead categories for tenant view
const LEAD_CATEGORIES = [
  { 
    key: "interested", 
    label: "Interesados", 
    description: "Leads que están interesados y en conversación activa",
    statuses: ["ENGAGED", "QUALIFYING"],
    icon: Sparkles,
    color: "from-cyan-500 to-blue-500",
    bgColor: "bg-cyan-500/10",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/30",
  },
  { 
    key: "in_progress", 
    label: "En Proceso", 
    description: "Leads siendo contactados o en calificación",
    statuses: ["CONTACTED", "SCORED", "TO_BE_CONTACTED"],
    icon: MessageSquare,
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/30",
  },
  { 
    key: "ready", 
    label: "Listos para vos", 
    description: "Leads calificados y entregados",
    statuses: ["LEAD_READY", "SENT_TO_DEVELOPER"],
    icon: CheckCircle,
    color: "from-emerald-500 to-green-500",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
  },
  { 
    key: "dropped", 
    label: "No Calificados", 
    description: "Leads que no cumplieron los criterios",
    statuses: ["DISQUALIFIED", "STOPPED", "COOLING", "REACTIVATION"],
    icon: XCircle,
    color: "from-slate-500 to-slate-600",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
    borderColor: "border-slate-500/30",
  },
];

// Drop reason mapping
const DROP_REASONS: Record<string, string> = {
  price_high: "Presupuesto por encima del rango",
  price_low: "Presupuesto por debajo del rango",
  wrong_zone: "Busca en otra zona",
  wrong_typology: "Busca otra tipología",
  no_response: "Sin respuesta después de varios intentos",
  not_interested: "Perdió interés en la búsqueda",
  missing_amenity: "Requiere amenidades no disponibles",
  timing: "Timing no compatible",
  financing: "Problemas con financiamiento",
  other: "Otros motivos",
  stopped: "Lead solicitó no ser contactado",
  cooling: "En pausa por falta de respuesta",
};

export default function PortalLeadsPage() {
  const toast = useToast();
  const { activeTenantId } = useAuth();
  const isMobile = useIsMobile();
  
  const [stats, setStats] = useState<TenantLeadStats | null>(null);
  const [leads, setLeads] = useState<TenantLeadView[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [offerFilter, setOfferFilter] = useState<string>("");
  const [offerOptions, setOfferOptions] = useState<Array<{value: string; label: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (activeTenantId) {
      loadData();
    }
  }, [activeTenantId]);
  
  useEffect(() => {
    if (activeTenantId && selectedCategory) {
      loadLeads();
    }
  }, [selectedCategory, offerFilter]);

  async function loadData() {
    if (!activeTenantId) return;
    
    setIsLoading(true);
    
    try {
      // Fetch stats for each category
      const categoryPromises = LEAD_CATEGORIES.map(async (cat) => {
        const { count } = await queryWithTimeout(
          supabase
            .from("lead_offers")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", activeTenantId)
            .in("status", cat.statuses),
          10000,
          `count ${cat.key}`
        );
        return { key: cat.key, count: count || 0 };
      });
      
      const results = await Promise.all(categoryPromises);
      
      const statsData: TenantLeadStats = {
        interested: results.find(r => r.key === "interested")?.count || 0,
        inProgress: results.find(r => r.key === "in_progress")?.count || 0,
        ready: results.find(r => r.key === "ready")?.count || 0,
        dropped: results.find(r => r.key === "dropped")?.count || 0,
      };
      
      setStats(statsData);
      
      // Load offer options for filter
      const { data: offersData } = await queryWithTimeout(
        supabase
          .from("offers")
          .select("id, name")
          .eq("tenant_id", activeTenantId)
          .in("status", ["ACTIVE", "PAUSED"])
          .order("name"),
        10000,
        "offers list"
      );
      
      if (offersData) {
        setOfferOptions([
          { value: "", label: "Todos los proyectos" },
          ...offersData.map((o: any) => ({ value: o.id, label: o.name }))
        ]);
      }
      
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }
  
  async function loadLeads() {
    if (!activeTenantId || !selectedCategory) return;
    
    setIsRefreshing(true);
    
    try {
      const category = LEAD_CATEGORIES.find(c => c.key === selectedCategory);
      if (!category) return;
      
      let query = supabase
        .from("lead_offers")
        .select(`
          id,
          status,
          score_total,
          qualification_fields,
          created_at,
          updated_at,
          lead:leads(first_name),
          offer:offers(name)
        `)
        .eq("tenant_id", activeTenantId)
        .in("status", category.statuses)
        .order("updated_at", { ascending: false })
        .limit(100);
      
      if (offerFilter) {
        query = query.eq("offer_id", offerFilter);
      }
      
      const { data, error } = await queryWithTimeout(query, 15000, "leads list");
      
      if (error) {
        console.error("Error fetching leads:", error);
        return;
      }
      
      if (data) {
        const processedLeads: TenantLeadView[] = data.map((d: any) => {
          const lead = Array.isArray(d.lead) ? d.lead[0] : d.lead;
          const offer = Array.isArray(d.offer) ? d.offer[0] : d.offer;
          const isDropped = selectedCategory === "dropped";
          
          // Get drop reason from qualification fields or status
          let dropReason: string | null = null;
          if (isDropped) {
            const qual = d.qualification_fields || {};
            // Try to determine drop reason
            if (d.status === "STOPPED") {
              dropReason = DROP_REASONS.stopped;
            } else if (d.status === "COOLING") {
              dropReason = DROP_REASONS.cooling;
            } else if (qual.disqualification_reason) {
              dropReason = DROP_REASONS[qual.disqualification_reason] || DROP_REASONS.other;
            } else {
              // Try to infer from qualification fields
              if (qual.budget && qual.price_mismatch) dropReason = DROP_REASONS.price_high;
              else if (qual.zone_mismatch) dropReason = DROP_REASONS.wrong_zone;
              else dropReason = DROP_REASONS.other;
            }
          }
          
          return {
            id: d.id,
            status: d.status,
            category: selectedCategory as TenantLeadView["category"],
            // Privacy: Hide personal info for dropped leads
            firstName: isDropped ? null : (lead?.first_name || "Lead"),
            offerName: offer?.name || null,
            score: d.score_total,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            dropReason,
          };
        });
        
        setLeads(processedLeads);
      }
      
    } catch (error) {
      console.error("Error loading leads:", error);
    } finally {
      setIsRefreshing(false);
    }
  }
  
  async function handleRefresh() {
    await loadData();
    if (selectedCategory) {
      await loadLeads();
    }
  }
  
  // Calculate totals
  const totalLeads = stats 
    ? stats.interested + stats.inProgress + stats.ready + stats.dropped 
    : 0;
  
  // Columns for lead table
  const getColumns = (): Column<TenantLeadView>[] => {
    const isDroppedCategory = selectedCategory === "dropped";
    
    if (isDroppedCategory) {
      // Dropped leads - privacy protected, no personal data
      return [
        {
          key: "lead",
          header: "Lead",
          cell: (l) => (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-600/30 flex items-center justify-center">
                <Users className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-tertiary)]">Lead anónimo</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Datos privados ocultos
                </p>
              </div>
            </div>
          ),
        },
        {
          key: "offer",
          header: "Proyecto",
          cell: (l) => (
            <span className="text-sm text-[var(--text-secondary)]">
              {l.offerName || "-"}
            </span>
          ),
        },
        {
          key: "reason",
          header: "Motivo",
          cell: (l) => (
            <div className="flex items-start gap-2 max-w-xs">
              <Info className="h-4 w-4 text-[var(--text-tertiary)] mt-0.5 flex-shrink-0" />
              <span className="text-sm text-[var(--text-tertiary)]">
                {l.dropReason || "Sin especificar"}
              </span>
            </div>
          ),
        },
        {
          key: "date",
          header: "Última actividad",
          cell: (l) => (
            <span className="text-sm text-[var(--text-tertiary)]">
              {formatRelativeTime(l.updatedAt)}
            </span>
          ),
        },
      ];
    }
    
    // Non-dropped leads - show relevant info
    return [
      {
        key: "lead",
        header: "Lead",
        cell: (l) => (
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center",
              l.category === "ready" 
                ? "bg-emerald-500/20" 
                : l.category === "interested"
                  ? "bg-cyan-500/20"
                  : "bg-amber-500/20"
            )}>
              <span className={cn(
                "text-sm font-medium",
                l.category === "ready" 
                  ? "text-emerald-400" 
                  : l.category === "interested"
                    ? "text-cyan-400"
                    : "text-amber-400"
              )}>
                {(l.firstName?.[0] || "L").toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {l.firstName || "Lead"}
              </p>
              {l.offerName && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {l.offerName}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "Estado",
        cell: (l) => {
          const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "info" | "primary" }> = {
            ENGAGED: { label: "Interesado", variant: "primary" },
            QUALIFYING: { label: "En calificación", variant: "primary" },
            CONTACTED: { label: "Contactado", variant: "info" },
            TO_BE_CONTACTED: { label: "Por contactar", variant: "warning" },
            SCORED: { label: "Calificado", variant: "info" },
            LEAD_READY: { label: "Listo", variant: "success" },
            SENT_TO_DEVELOPER: { label: "Entregado", variant: "success" },
          };
          const config = statusLabels[l.status] || { label: l.status, variant: "info" as const };
          return <Badge variant={config.variant} dot>{config.label}</Badge>;
        },
      },
      {
        key: "score",
        header: "Score",
        cell: (l) => (
          l.score !== null ? (
            <div className="flex items-center gap-2">
              <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full",
                    l.score >= 70 ? "bg-emerald-500" :
                    l.score >= 40 ? "bg-amber-500" : "bg-slate-500"
                  )}
                  style={{ width: `${l.score}%` }}
                />
              </div>
              <span className="text-sm font-medium text-[var(--text-secondary)]">{l.score}</span>
            </div>
          ) : (
            <span className="text-[var(--text-tertiary)] text-sm">-</span>
          )
        ),
      },
      {
        key: "date",
        header: "Última actividad",
        cell: (l) => (
          <span className="text-sm text-[var(--text-tertiary)]">
            {formatRelativeTime(l.updatedAt)}
          </span>
        ),
      },
    ];
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mis Leads"
        description="Seguimiento del estado de tus leads en el funnel de calificación"
        breadcrumbs={[
          { label: "Portal", href: "/portal" },
          { label: "Mis Leads" },
        ]}
        actions={
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleRefresh}
            leftIcon={<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />}
          >
            Actualizar
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {LEAD_CATEGORIES.map((category) => {
          const count = stats?.[category.key === "in_progress" ? "inProgress" : category.key as keyof TenantLeadStats] || 0;
          const Icon = category.icon;
          const isSelected = selectedCategory === category.key;
          
          return (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(isSelected ? null : category.key)}
              className={cn(
                "relative p-4 rounded-2xl border-2 transition-all duration-200 text-left",
                "hover:scale-[1.02] active:scale-[0.98]",
                isSelected 
                  ? "border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10" 
                  : cn("border-transparent", category.bgColor),
                category.borderColor
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center",
                  `bg-gradient-to-br ${category.color}`
                )}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className={cn("text-2xl font-bold", category.textColor)}>
                  {count}
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {category.label}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                {category.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Funnel visualization */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-400" />
            Tu Funnel de Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {LEAD_CATEGORIES.slice(0, 3).map((category, index) => {
              const count = stats?.[category.key === "in_progress" ? "inProgress" : category.key as keyof TenantLeadStats] || 0;
              const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
              
              return (
                <div key={category.key} className="flex items-center flex-1">
                  <div className="flex-1 text-center">
                    <div className={cn(
                      "mx-auto h-16 w-16 md:h-20 md:w-20 rounded-2xl flex items-center justify-center mb-2",
                      `bg-gradient-to-br ${category.color}`
                    )}>
                      <span className="text-xl md:text-2xl font-bold text-white">{count}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{category.label}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{percentage}%</p>
                  </div>
                  {index < 2 && (
                    <div className="px-2 md:px-4">
                      <ArrowRight className="h-6 w-6 text-[var(--text-tertiary)]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Conversion rate */}
          {stats && stats.ready > 0 && totalLeads > 0 && (
            <div className="mt-6 pt-4 border-t border-[var(--border-primary)] text-center">
              <p className="text-sm text-[var(--text-tertiary)]">
                Tasa de conversión: 
                <span className="font-semibold text-emerald-400 ml-1">
                  {Math.round((stats.ready / totalLeads) * 100)}%
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead List */}
      {selectedCategory ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const cat = LEAD_CATEGORIES.find(c => c.key === selectedCategory);
                  const Icon = cat?.icon || Users;
                  return <Icon className={cn("h-5 w-5", cat?.textColor)} />;
                })()}
                {LEAD_CATEGORIES.find(c => c.key === selectedCategory)?.label}
              </CardTitle>
              <div className="w-full sm:w-64">
                <CustomSelect
                  value={offerFilter}
                  onValueChange={setOfferFilter}
                  options={offerOptions}
                  placeholder="Filtrar por proyecto..."
                />
              </div>
            </div>
          </CardHeader>
          
          {selectedCategory === "dropped" && (
            <div className="mx-4 mb-4 p-4 rounded-lg bg-slate-500/10 border border-slate-500/20">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Privacidad de datos
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Por políticas de privacidad, los datos personales de los leads no calificados están ocultos. 
                    Solo se muestra el motivo por el cual no cumplieron los criterios de calificación.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className={isMobile ? "p-4" : ""}>
            <ResponsiveList
              data={leads}
              columns={getColumns()}
              keyExtractor={(l) => l.id}
              isLoading={isRefreshing}
              renderMobileItem={(l) => {
                const isDropped = l.category === "dropped";
                const categoryInfo = LEAD_CATEGORIES.find(c => c.key === l.category);
                
                const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "info" | "primary" }> = {
                  ENGAGED: { label: "Interesado", variant: "primary" },
                  QUALIFYING: { label: "En calificación", variant: "primary" },
                  CONTACTED: { label: "Contactado", variant: "info" },
                  TO_BE_CONTACTED: { label: "Por contactar", variant: "warning" },
                  SCORED: { label: "Calificado", variant: "info" },
                  LEAD_READY: { label: "Listo", variant: "success" },
                  SENT_TO_DEVELOPER: { label: "Entregado", variant: "success" },
                };
                const statusConfig = statusLabels[l.status] || { label: l.status, variant: "info" as const };
                
                return (
                  <MobileCard
                    avatar={
                      isDropped ? (
                        <MobileCardAvatar variant="default" icon={Users} />
                      ) : (
                        <MobileCardAvatar 
                          variant={l.category === "ready" ? "success" : l.category === "interested" ? "info" : "warning"} 
                          fallback={l.firstName || "L"}
                        />
                      )
                    }
                    title={isDropped ? "Lead anónimo" : (l.firstName || "Lead")}
                    subtitle={l.offerName || undefined}
                    badges={
                      isDropped ? (
                        <span className="text-xs text-muted-foreground">{l.dropReason || "Sin especificar"}</span>
                      ) : (
                        <Badge variant={statusConfig.variant} size="sm" dot>{statusConfig.label}</Badge>
                      )
                    }
                    stats={l.score !== null && !isDropped ? [
                      { icon: Star, value: l.score, label: "Score" },
                    ] : undefined}
                    metadata={formatRelativeTime(l.updatedAt)}
                    showChevron={false}
                    variant={isDropped ? "muted" : "default"}
                  />
                );
              }}
              emptyState={
                <EmptyState
                  icon={<Users />}
                  title={`Sin leads ${LEAD_CATEGORIES.find(c => c.key === selectedCategory)?.label.toLowerCase()}`}
                  description="No hay leads en esta categoría actualmente."
                  size="sm"
                />
              }
            />
          </div>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
              Seleccioná una categoría
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto">
              Hacé click en cualquiera de las categorías de arriba para ver los leads en ese estado del funnel.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info card about how it works */}
      <Card className="mt-6 bg-gradient-to-br from-primary-600/10 to-purple-600/10 border-primary-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                ¿Cómo funciona el proceso de calificación?
              </h3>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>
                  <strong className="text-[var(--text-primary)]">1. Leads en proceso:</strong> Nuestro sistema contacta automáticamente a los leads que llegan desde tus campañas.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)]">2. Leads interesados:</strong> Cuando un lead responde y muestra interés, entra en el proceso de calificación conversacional.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)]">3. Leads listos:</strong> Una vez calificados (presupuesto, zona, timing, etc.), los leads se entregan automáticamente a tus sistemas.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)]">4. No calificados:</strong> Los leads que no cumplen los criterios se descartan, protegiendo su privacidad.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

