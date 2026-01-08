/**
 * Standardized funnel stages for tenant views
 * This ensures consistency across all tenant-facing pages
 */

export type TenantFunnelStageKey = 
  | "received" 
  | "in_chat" 
  | "qualified" 
  | "delivered" 
  | "not_qualified";

export interface TenantFunnelStage {
  key: TenantFunnelStageKey;
  label: string;
  description: string;
  statuses: string[];
  color: string;
  bgColor: string;
  textColor: string;
  borderColor?: string;
}

/**
 * Standardized funnel stages for tenant portal
 * These names are used consistently across:
 * - Portal Dashboard
 * - Project Detail Page
 * - My Leads Page
 */
export const TENANT_FUNNEL_STAGES: TenantFunnelStage[] = [
  {
    key: "received",
    label: "Recibidos",
    description: "Leads recibidos pendientes de mapeo o contacto",
    statuses: ["PENDING_MAPPING", "TO_BE_CONTACTED"],
    color: "from-slate-500 to-slate-600",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
    borderColor: "border-slate-500/30",
  },
  {
    key: "in_chat",
    label: "En Chat",
    description: "Leads en conversación activa",
    statuses: ["CONTACTED", "ENGAGED", "QUALIFYING", "HUMAN_HANDOFF"],
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
    borderColor: "border-blue-500/30",
  },
  {
    key: "qualified",
    label: "Calificados",
    description: "Leads calificados y listos para entrega",
    statuses: ["SCORED", "LEAD_READY"],
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
    borderColor: "border-purple-500/30",
  },
  {
    key: "delivered",
    label: "Entregados",
    description: "Leads entregados y disponibles para contacto",
    statuses: ["SENT_TO_DEVELOPER"],
    color: "from-emerald-500 to-green-500",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
  },
  {
    key: "not_qualified",
    label: "No Calificados",
    description: "Leads que no cumplieron los criterios de calificación",
    statuses: ["DISQUALIFIED", "STOPPED", "COOLING", "REACTIVATION"],
    color: "from-slate-500 to-slate-600",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
    borderColor: "border-slate-500/30",
  },
];

/**
 * Get funnel stage by key
 */
export function getFunnelStage(key: TenantFunnelStageKey): TenantFunnelStage | undefined {
  return TENANT_FUNNEL_STAGES.find(stage => stage.key === key);
}

/**
 * Get funnel stage by status
 */
export function getFunnelStageByStatus(status: string): TenantFunnelStage | undefined {
  return TENANT_FUNNEL_STAGES.find(stage => stage.statuses.includes(status));
}

/**
 * Map database funnel stats to standardized stages
 * This helps convert from database views (offer_funnel_stats) to our standard format
 */
export interface DatabaseFunnelStats {
  total_leads?: number;
  leads_pending_mapping?: number;
  leads_pending_contact?: number;
  leads_in_chat?: number;
  leads_qualified?: number;
  leads_delivered?: number;
  leads_disqualified?: number;
  leads_stopped?: number;
}

export interface StandardizedFunnelData {
  received: number;
  in_chat: number;
  qualified: number;
  delivered: number;
  not_qualified: number;
}

/**
 * Convert database funnel stats to standardized format
 * "received" = leads_pending_mapping + leads_pending_contact (not total_leads)
 */
export function standardizeFunnelStats(dbStats: DatabaseFunnelStats): StandardizedFunnelData {
  return {
    received: (dbStats.leads_pending_mapping || 0) + (dbStats.leads_pending_contact || 0),
    in_chat: dbStats.leads_in_chat || 0,
    qualified: dbStats.leads_qualified || 0,
    delivered: dbStats.leads_delivered || 0,
    not_qualified: (dbStats.leads_disqualified || 0) + (dbStats.leads_stopped || 0),
  };
}
