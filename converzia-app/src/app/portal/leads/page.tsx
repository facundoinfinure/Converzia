"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserCheck,
  MessageSquare,
  XCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Filter,
  RefreshCw,
  Info,
  AlertTriangle,
  Star,
  TrendingUp,
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
import { TENANT_FUNNEL_STAGES, type TenantFunnelStage } from "@/lib/constants/tenant-funnel";

// ============================================
// Types - Privacy-focused for tenants
// ============================================

interface TenantLeadStats {
  received: number;      // PENDING_MAPPING + TO_BE_CONTACTED
  in_chat: number;        // CONTACTED, ENGAGED, QUALIFYING
  qualified: number;     // SCORED, LEAD_READY
  delivered: number;     // SENT_TO_DEVELOPER
  not_qualified: number; // DISQUALIFIED, STOPPED, COOLING, REACTIVATION
}

// Simplified lead view for tenants - NO personal data for dropped leads
interface TenantLeadView {
  id: string;
  status: string;
  category: "received" | "in_chat" | "qualified" | "delivered" | "not_qualified";
  // Basic info - only shown for non-dropped leads
  firstName: string | null;  // Hidden for dropped leads, only first name for received
  offerName: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
  // For dropped leads - only show summary
  dropReason: string | null;
}

// Lead categories for tenant view - using standardized funnel stages
// Map standardized stages to icons for the leads page
const LEAD_CATEGORY_ICONS: Record<string, typeof Users> = {
  received: Users,
  in_chat: MessageSquare,
  qualified: TrendingUp,
  delivered: CheckCircle,
  not_qualified: XCircle,
};

// Lead categories for tenant view - using standardized names
// Include "received" as a selectable category
const LEAD_CATEGORIES = TENANT_FUNNEL_STAGES
  .map((stage): TenantFunnelStage & { icon: typeof Users } => ({
    ...stage,
    icon: LEAD_CATEGORY_ICONS[stage.key] || Users,
  }));

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
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    if (!activeTenantId) return;
    
    setIsLoadingStats(true);
    
    try {
      // Use API endpoint to bypass RLS restrictions on lead_offers
      // The RLS policy only allows SENT_TO_DEVELOPER status, so views show wrong counts
      const statsResponse = await fetch(`/api/portal/leads/stats?tenant_id=${activeTenantId}`);
      
      if (!statsResponse.ok) {
        const errorData = await statsResponse.json();
        throw new Error(errorData.message || "Error al cargar estadísticas");
      }
      
      const { stats: apiStats } = await statsResponse.json();
      
      const statsData: TenantLeadStats = {
        received: apiStats?.received || 0,
        in_chat: apiStats?.in_chat || 0,
        qualified: apiStats?.qualified || 0,
        delivered: apiStats?.delivered || 0,
        not_qualified: apiStats?.not_qualified || 0,
      };
      
      setStats(statsData);
      
      // Load offer options for filter
      const { data: offersDataRaw } = await queryWithTimeout(
        supabase
          .from("offers")
          .select("id, name")
          .eq("tenant_id", activeTenantId)
          .in("status", ["ACTIVE", "PAUSED"])
          .order("name"),
        10000,
        "offers list"
      );
      
      const offersData = Array.isArray(offersDataRaw) ? offersDataRaw as Array<{ id: string; name: string }> : [];
      
      if (offersData.length > 0) {
        setOfferOptions([
          { value: "", label: "Todos los proyectos" },
          ...offersData.map((o) => ({ value: o.id, label: o.name }))
        ]);
      }
      
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Error al cargar datos");
      } finally {
        setIsLoadingStats(false);
      }
    }, [activeTenantId, supabase, toast]);

  const loadLeads = useCallback(async () => {
    if (!activeTenantId || !selectedCategory) return;
    
    setIsLoadingLeads(true);
    setIsRefreshing(true);
    
    try {
      const category = LEAD_CATEGORIES.find(c => c.key === selectedCategory);
      if (!category) return;
      
      // For "received" category, only query PENDING_MAPPING and TO_BE_CONTACTED
      const statuses = selectedCategory === "received" 
        ? ["PENDING_MAPPING", "TO_BE_CONTACTED"]
        : category.statuses;
      
      // Use API endpoint that bypasses RLS restrictions
      // RLS only allows SENT_TO_DEVELOPER status, but we need to see all funnel stages
      const params = new URLSearchParams({
        tenant_id: activeTenantId,
        statuses: statuses.join(","),
        limit: "50",
      });
      
      if (offerFilter) {
        params.set("offer_id", offerFilter);
      }
      
      const response = await fetch(`/api/portal/leads?${params.toString()}`);
      
      // SIEMPRE resetear el array primero
      setLeads([]);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error fetching leads:", errorData);
        toast.error("Error al cargar leads");
        return;
      }
      
      const { data } = await response.json();
      const leadsData = data?.leads || [];
      const offerNames: Record<string, string> = data?.offerNames || {};
      
      console.log("[Leads] Loaded:", { count: leadsData.length, category: selectedCategory });
      
      if (leadsData.length > 0) {
        // Process leads with offer names
        const processedLeads: TenantLeadView[] = leadsData
          .map((d: any) => {
            const isDropped = selectedCategory === "not_qualified";
            
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
              // Privacy: For dropped leads, hide personal info. Otherwise show "Lead" as default
              firstName: isDropped ? null : "Lead",
              offerName: d.offer_id ? (offerNames[d.offer_id] || null) : null,
              score: d.score_total,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
              dropReason,
            };
          });
        
        setLeads(processedLeads);
      } else {
        // Asegurar que el array esté vacío cuando no hay resultados
        setLeads([]);
      }
      
    } catch (error) {
      console.error("Error loading leads:", error);
      // Resetear array en caso de error
      setLeads([]);
      toast.error("Error al cargar leads");
    } finally {
      setIsLoadingLeads(false);
      setIsRefreshing(false);
    }
  }, [activeTenantId, selectedCategory, offerFilter, toast]);

  useEffect(() => {
    if (activeTenantId) {
      loadData();
    }
  }, [activeTenantId, loadData]);
  
  useEffect(() => {
    if (activeTenantId && selectedCategory) {
      loadLeads();
    }
  }, [activeTenantId, selectedCategory, offerFilter, loadLeads]);
  
  async function handleRefresh() {
    await loadData();
    if (selectedCategory) {
      await loadLeads();
    }
  }
  
  // Calculate totals
  // Columns for lead table
  const getColumns = (): Column<TenantLeadView>[] => {
    const isDroppedCategory = selectedCategory === "not_qualified";
    const isReceivedCategory = selectedCategory === "received";
    
    if (isReceivedCategory) {
      // Received leads - only first name (no last name, email, phone) but show offer data
      return [
        {
          key: "lead",
          header: "Lead",
          cell: (l) => (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full flex items-center justify-center bg-[var(--bg-tertiary)]">
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  {(l.firstName?.[0] || "L").toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  {l.firstName || "Lead"}
                </p>
              </div>
            </div>
          ),
        },
        {
          key: "offer",
          header: "Proyecto",
          cell: (l) => (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {l.offerName || "Sin proyecto asignado"}
              </span>
              {l.offerName && (
                <span className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Oferta por la cual se recibió
                </span>
              )}
            </div>
          ),
        },
        {
          key: "status",
          header: "Estado",
          cell: (l) => {
            const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "info" | "primary" }> = {
              PENDING_MAPPING: { label: "Pendiente de mapeo", variant: "warning" },
              TO_BE_CONTACTED: { label: "Por contactar", variant: "warning" },
            };
            const config = statusLabels[l.status] || { label: l.status, variant: "info" as const };
            return <Badge variant={config.variant} dot>{config.label}</Badge>;
          },
        },
        {
          key: "date",
          header: "Fecha de recepción",
          cell: (l) => (
            <span className="text-sm text-[var(--text-tertiary)]">
              {formatRelativeTime(l.createdAt)}
            </span>
          ),
        },
      ];
    }
    
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
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-[var(--bg-tertiary)]">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
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
                  className="h-full rounded-full bg-[var(--text-secondary)]"
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

  // No bloqueo completo - siempre mostrar estructura

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {isLoadingStats ? (
          // Skeletons for stats cards
          LEAD_CATEGORIES.map((category) => (
            <div
              key={category.key}
              className="relative p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]"
            >
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="text-right space-y-1">
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))
        ) : (
          LEAD_CATEGORIES.map((category, index) => {
            const count = stats?.[category.key as keyof TenantLeadStats] || 0;
            const Icon = category.icon;
            const isSelected = selectedCategory === category.key;
            
            // Calculate percentage based on "received" (initial stage)
            let percentage: number | null = null;
            if (stats && stats.received > 0) {
              const currentCount = stats[category.key as keyof TenantLeadStats] || 0;
              percentage = Math.round((currentCount / stats.received) * 100);
            }
            
            return (
              <button
                key={category.key}
                onClick={() => setSelectedCategory(isSelected ? null : category.key)}
                className={cn(
                  "relative p-4 rounded-lg border transition-all duration-200 text-left",
                  isSelected 
                    ? "border-[var(--border-primary)] bg-[var(--bg-secondary)]" 
                    : "border-[var(--border-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-[var(--text-primary)] block">
                      {count}
                    </span>
                    {percentage !== null && category.key !== "received" && (
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {percentage}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {category.label}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                  {category.description}
                </p>
              </button>
            );
          })
        )}
      </div>

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
          
          {selectedCategory === "not_qualified" && (
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
              isLoading={isLoadingLeads || isRefreshing}
              renderMobileItem={(l) => {
                const isDropped = l.category === "not_qualified";
                const isReceived = l.category === "received";
                const categoryInfo = LEAD_CATEGORIES.find(c => c.key === l.category);
                
                const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "info" | "primary" }> = {
                  PENDING_MAPPING: { label: "Pendiente de mapeo", variant: "warning" },
                  TO_BE_CONTACTED: { label: "Por contactar", variant: "warning" },
                  ENGAGED: { label: "Interesado", variant: "primary" },
                  QUALIFYING: { label: "En calificación", variant: "primary" },
                  CONTACTED: { label: "Contactado", variant: "info" },
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
                          variant={
                            l.category === "delivered" ? "success" : 
                            l.category === "in_chat" ? "info" : 
                            l.category === "qualified" ? "default" : 
                            l.category === "received" ? "warning" : 
                            "warning"
                          } 
                          fallback={l.firstName || "L"}
                        />
                      )
                    }
                    title={isDropped ? "Lead anónimo" : (l.firstName || "Lead")}
                    subtitle={isReceived ? (l.offerName ? `Proyecto: ${l.offerName}` : "Sin proyecto asignado") : (l.offerName || undefined)}
                    badges={
                      isDropped ? (
                        <span className="text-xs text-muted-foreground">{l.dropReason || "Sin especificar"}</span>
                      ) : (
                        <Badge variant={statusConfig.variant} size="sm" dot>{statusConfig.label}</Badge>
                      )
                    }
                    stats={l.score !== null && !isDropped && !isReceived ? [
                      { icon: Star, value: l.score, label: "Score" },
                    ] : undefined}
                    metadata={isReceived ? formatRelativeTime(l.createdAt) : formatRelativeTime(l.updatedAt)}
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
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
              <Info className="h-6 w-6 text-[var(--text-secondary)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                ¿Cómo funciona el proceso de calificación?
              </h3>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>
                  <strong className="text-[var(--text-primary)]">1. Leads recibidos:</strong> Los leads que llegan desde tus campañas entran al sistema y son mapeados a tus proyectos.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)]">2. Leads en chat:</strong> Nuestro sistema contacta automáticamente a los leads y cuando responden, entran en el proceso de calificación conversacional.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)]">3. Leads calificados:</strong> Una vez calificados (presupuesto, zona, timing, etc.), los leads están listos para entrega.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)]">4. Leads entregados:</strong> Los leads calificados se entregan automáticamente a tus sistemas.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)]">5. No calificados:</strong> Los leads que no cumplen los criterios se descartan, protegiendo su privacidad.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

