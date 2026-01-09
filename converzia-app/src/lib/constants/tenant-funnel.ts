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

// ============================================
// Status Sets (for consistent filtering)
// ============================================

/**
 * Get status sets from TENANT_FUNNEL_STAGES
 * This is the SINGLE SOURCE OF TRUTH for status groupings
 */
export function getStatusSets(): Record<TenantFunnelStageKey, Set<string>> {
  return TENANT_FUNNEL_STAGES.reduce((acc, stage) => {
    acc[stage.key] = new Set(stage.statuses);
    return acc;
  }, {} as Record<TenantFunnelStageKey, Set<string>>);
}

/**
 * Get all statuses for a given funnel stage key
 */
export function getStatusesForStage(key: TenantFunnelStageKey): string[] {
  const stage = getFunnelStage(key);
  return stage?.statuses || [];
}

/**
 * Check if a status belongs to a specific funnel stage
 */
export function isStatusInStage(status: string, stageKey: TenantFunnelStageKey): boolean {
  const stage = getFunnelStage(stageKey);
  return stage?.statuses.includes(status) || false;
}

// ============================================
// Lead Counting (Client-side compatible)
// ============================================

/**
 * Count leads by category using TENANT_FUNNEL_STAGES
 * This can be used both client-side and server-side
 */
export function countLeadsByCategory(
  leads: Array<{ status: string }>
): StandardizedFunnelData {
  const statusSets = getStatusSets();
  
  return {
    received: leads.filter(l => statusSets.received.has(l.status)).length,
    in_chat: leads.filter(l => statusSets.in_chat.has(l.status)).length,
    qualified: leads.filter(l => statusSets.qualified.has(l.status)).length,
    delivered: leads.filter(l => statusSets.delivered.has(l.status)).length,
    not_qualified: leads.filter(l => statusSets.not_qualified.has(l.status)).length,
  };
}

/**
 * Verify that all leads are accounted for in the categories
 * Returns true if the sum of all categories equals total leads
 */
export function verifyFunnelCounts(data: StandardizedFunnelData, totalLeads: number): boolean {
  const sum = data.received + data.in_chat + data.qualified + data.delivered + data.not_qualified;
  return sum === totalLeads;
}

/**
 * Get all valid lead statuses from TENANT_FUNNEL_STAGES
 */
export function getAllValidStatuses(): string[] {
  return TENANT_FUNNEL_STAGES.flatMap(stage => stage.statuses);
}

/**
 * Find leads with unmapped statuses (not in any funnel stage)
 */
export function findUnmappedStatuses(leads: Array<{ status: string }>): string[] {
  const validStatuses = new Set(getAllValidStatuses());
  const unmapped = new Set<string>();
  
  for (const lead of leads) {
    if (!validStatuses.has(lead.status)) {
      unmapped.add(lead.status);
    }
  }
  
  return Array.from(unmapped);
}
