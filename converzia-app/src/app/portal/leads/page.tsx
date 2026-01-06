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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    if (!activeTenantId) return;
    
    setIsLoading(true);
    
    try {
      // Use tenant_funnel_stats view for consistent stats (same source as dashboard)
      const { data: funnelStatsData } = await queryWithTimeout(
        supabase
          .from("tenant_funnel_stats")
          .select("*")
          .eq("tenant_id", activeTenantId)
          .maybeSingle(),
        10000,
        "tenant funnel stats"
      );

      interface TenantFunnelStats {
        leads_pending_mapping?: number;
        leads_pending_contact?: number;
        leads_in_chat?: number;
        leads_qualified?: number;
        leads_delivered?: number;
        leads_disqualified?: number;
        leads_stopped?: number;
      }

      const funnelStats = funnelStatsData as TenantFunnelStats | null;
      
      // Map funnel stats to our format using the same logic as standardizeFunnelStats
      // "received" = leads_pending_mapping + leads_pending_contact
      const statsData: TenantLeadStats = {
        received: (funnelStats?.leads_pending_mapping || 0) + (funnelStats?.leads_pending_contact || 0),
        in_chat: funnelStats?.leads_in_chat || 0,
        qualified: funnelStats?.leads_qualified || 0,
        delivered: funnelStats?.leads_delivered || 0,
        not_qualified: (funnelStats?.leads_disqualified || 0) + (funnelStats?.leads_stopped || 0),
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
      setIsLoading(false);
    }
  }, [activeTenantId, supabase, toast]);

  const loadLeads = useCallback(async () => {
    if (!activeTenantId || !selectedCategory) return;
    
    setIsRefreshing(true);
    
    try {
      const category = LEAD_CATEGORIES.find(c => c.key === selectedCategory);
      if (!category) return;
      
      // For "received" category, only query PENDING_MAPPING and TO_BE_CONTACTED
      const statuses = selectedCategory === "received" 
        ? ["PENDING_MAPPING", "TO_BE_CONTACTED"]
        : category.statuses;
      
      // Optimized query: filter by tenant_id first (uses index), then status, then order
      // This order matches the composite index idx_lead_offers_tenant_status_updated
      // Specify foreign key explicitly to avoid ambiguity (offer_id vs recommended_offer_id)
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
          offer:offers!lead_offers_offer_id_fkey(name)
        `)
        .eq("tenant_id", activeTenantId)
        .in("status", statuses)
        .order("updated_at", { ascending: false })
        .limit(50); // Reduced from 100 to improve performance
      
      if (offerFilter) {
        // When filtering by offer, use the idx_lead_offers_tenant_status_offer index
        query = query.eq("offer_id", offerFilter);
      }
      
      // Increased timeout slightly for queries with joins, but queries should be faster with indexes
      const { data: leadsDataRaw, error } = await queryWithTimeout(query, 20000, "leads list");
      
      // SIEMPRE resetear el array primero
      setLeads([]);
      
      if (error) {
        console.error("Error fetching leads:", error);
        toast.error("Error al cargar leads");
        return;
      }
      
      const leadsData = Array.isArray(leadsDataRaw) ? leadsDataRaw : [];
      
      if (leadsData.length > 0) {
        // Filtrar y validar datos antes de procesarlos
        const processedLeads: TenantLeadView[] = leadsData
          .filter((d: any) => {
            // Validar que tenga los datos mínimos necesarios
            const lead = Array.isArray(d.lead) ? d.lead[0] : d.lead;
            const offer = Array.isArray(d.offer) ? d.offer[0] : d.offer;
            
            // Para "in_chat" y "received", necesitamos al menos el lead (puede no tener offer asignado aún)
            if (selectedCategory === "in_chat" || selectedCategory === "received") {
              return lead !== null && lead !== undefined;
            }
            
            // Para "not_qualified", no necesitamos validar lead (está oculto por privacidad)
            if (selectedCategory === "not_qualified") {
              return true; // Todos los leads descalificados son válidos
            }
            
            // Para otras categorías, validar que exista el lead
            return lead !== null && lead !== undefined;
          })
          .map((d: any) => {
            const lead = Array.isArray(d.lead) ? d.lead[0] : d.lead;
            const offer = Array.isArray(d.offer) ? d.offer[0] : d.offer;
            const isDropped = selectedCategory === "not_qualified";
            const isReceived = selectedCategory === "received";
            
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
              // Privacy: For received, only show first name (no last name, email, phone)
              // For dropped leads, hide all personal info
              // Manejar caso cuando lead?.first_name es null
              firstName: isDropped ? null : (lead?.first_name || "Lead"),
              offerName: offer?.name || null,
              score: d.score_total,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
              dropReason,
            };
          });
        
        setLeads(processedLeads);
        
        // Logging para debug de inconsistencias
        if (processedLeads.length !== leadsData.length) {
          console.warn(`[Leads] Filtrados ${leadsData.length - processedLeads.length} leads inválidos de ${leadsData.length} totales`);
        }
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
      setIsRefreshing(false);
    }
  }, [activeTenantId, selectedCategory, offerFilter, supabase]);

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

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32" />)}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {LEAD_CATEGORIES.map((category, index) => {
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
        })}
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
              isLoading={isRefreshing}
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

