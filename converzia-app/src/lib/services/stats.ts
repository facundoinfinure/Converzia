/**
 * Stats Service - Single Source of Truth
 * 
 * This service provides all statistics for Portal and Admin dashboards.
 * It uses the admin client to bypass RLS and TENANT_FUNNEL_STAGES as the
 * single source of truth for status groupings.
 * 
 * ALL stats queries should go through this service to ensure consistency.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { TENANT_FUNNEL_STAGES, type TenantFunnelStageKey } from "@/lib/constants/tenant-funnel";
import { cacheService, cacheKeys, CacheTTL, invalidateCache } from "./cache";
import { logger } from "@/lib/utils/logger";

// ============================================
// Types
// ============================================

export interface TenantFunnelStats {
  tenantId: string;
  tenantName: string;
  
  // Funnel counts (using standardized categories from TENANT_FUNNEL_STAGES)
  received: number;        // PENDING_MAPPING, TO_BE_CONTACTED
  inChat: number;          // CONTACTED, ENGAGED, QUALIFYING, HUMAN_HANDOFF
  qualified: number;       // SCORED, LEAD_READY
  delivered: number;       // SENT_TO_DEVELOPER
  notQualified: number;    // DISQUALIFIED, STOPPED, COOLING, REACTIVATION
  
  // Total (should equal sum of all categories)
  totalLeads: number;
  
  // Derived metrics
  conversionRate: number;  // delivered / totalLeads * 100
  
  // Credit balance
  creditBalance: number;
  
  // Offer counts
  activeOffers: number;
  
  // Pipeline breakdown (for detailed view)
  pipelineStats: {
    pendingMapping: number;
    toBeContacted: number;
    contacted: number;
    engaged: number;
    qualifying: number;
    humanHandoff: number;
    scored: number;
    leadReady: number;
    sentToDeveloper: number;
    cooling: number;
    reactivation: number;
    disqualified: number;
    stopped: number;
  };
  
  // Disqualification breakdown
  disqualificationBreakdown: {
    priceHigh: number;
    priceLow: number;
    wrongZone: number;
    wrongTypology: number;
    noResponse: number;
    notInterested: number;
    missingAmenity: number;
    duplicate: number;
    other: number;
  };
}

export interface OfferFunnelStats {
  offerId: string;
  offerName: string;
  offerStatus: string;
  approvalStatus: string;
  tenantId: string;
  
  // Funnel counts
  received: number;
  inChat: number;
  qualified: number;
  delivered: number;
  notQualified: number;
  totalLeads: number;
  
  // Derived metrics
  conversionRate: number;
  
  // Pipeline breakdown
  pipelineStats: {
    pendingMapping: number;
    toBeContacted: number;
    contacted: number;
    engaged: number;
    qualifying: number;
    humanHandoff: number;
    scored: number;
    leadReady: number;
    sentToDeveloper: number;
    cooling: number;
    reactivation: number;
    disqualified: number;
    stopped: number;
  };
  
  // Disqualification breakdown
  disqualificationBreakdown: {
    priceHigh: number;
    priceLow: number;
    wrongZone: number;
    wrongTypology: number;
    noResponse: number;
    notInterested: number;
    missingAmenity: number;
    duplicate: number;
    other: number;
  };
  
  // Time range
  firstLeadAt: string | null;
  lastLeadAt: string | null;
}

export interface AdminDashboardStats {
  // Lead stats
  totalLeads: number;
  leadsToday: number;
  
  // Tenant stats
  activeTenants: number;
  pendingApprovals: number;
  
  // Pipeline stats
  leadReadyRate: number;
  unmappedAds: number;
  lowCreditTenants: number;
  
  // Response time
  avgResponseTime: string;
  
  // Trend data (last 30 days)
  leadsTrend: Array<{ date: string; value: number }>;
}

// ============================================
// Status Grouping (using TENANT_FUNNEL_STAGES)
// ============================================

/**
 * Build status sets from TENANT_FUNNEL_STAGES for guaranteed consistency
 * This is the SINGLE SOURCE OF TRUTH for status groupings
 */
function getStatusSets(): Record<TenantFunnelStageKey, Set<string>> {
  return TENANT_FUNNEL_STAGES.reduce((acc, stage) => {
    acc[stage.key] = new Set(stage.statuses);
    return acc;
  }, {} as Record<TenantFunnelStageKey, Set<string>>);
}

/**
 * Count leads by status using TENANT_FUNNEL_STAGES
 */
function countLeadsByCategory(
  leads: Array<{ status: string; disqualification_category?: string | null }>
): {
  categories: Record<TenantFunnelStageKey, number>;
  pipeline: TenantFunnelStats["pipelineStats"];
  disqualification: TenantFunnelStats["disqualificationBreakdown"];
} {
  const statusSets = getStatusSets();
  
  // Initialize pipeline counts
  const pipeline = {
    pendingMapping: 0,
    toBeContacted: 0,
    contacted: 0,
    engaged: 0,
    qualifying: 0,
    humanHandoff: 0,
    scored: 0,
    leadReady: 0,
    sentToDeveloper: 0,
    cooling: 0,
    reactivation: 0,
    disqualified: 0,
    stopped: 0,
  };
  
  // Initialize disqualification counts
  const disqualification = {
    priceHigh: 0,
    priceLow: 0,
    wrongZone: 0,
    wrongTypology: 0,
    noResponse: 0,
    notInterested: 0,
    missingAmenity: 0,
    duplicate: 0,
    other: 0,
  };
  
  // Status to pipeline key mapping
  const statusToPipelineKey: Record<string, keyof typeof pipeline> = {
    PENDING_MAPPING: "pendingMapping",
    TO_BE_CONTACTED: "toBeContacted",
    CONTACTED: "contacted",
    ENGAGED: "engaged",
    QUALIFYING: "qualifying",
    HUMAN_HANDOFF: "humanHandoff",
    SCORED: "scored",
    LEAD_READY: "leadReady",
    SENT_TO_DEVELOPER: "sentToDeveloper",
    COOLING: "cooling",
    REACTIVATION: "reactivation",
    DISQUALIFIED: "disqualified",
    STOPPED: "stopped",
  };
  
  // Disqualification category mapping
  const dqCategoryMap: Record<string, keyof typeof disqualification> = {
    PRICE_TOO_HIGH: "priceHigh",
    PRICE_TOO_LOW: "priceLow",
    WRONG_ZONE: "wrongZone",
    WRONG_TYPOLOGY: "wrongTypology",
    NO_RESPONSE: "noResponse",
    NOT_INTERESTED: "notInterested",
    MISSING_AMENITY: "missingAmenity",
    DUPLICATE: "duplicate",
    OTHER: "other",
  };
  
  // Count leads
  for (const lead of leads) {
    // Pipeline count
    const pipelineKey = statusToPipelineKey[lead.status];
    if (pipelineKey) {
      pipeline[pipelineKey]++;
    }
    
    // Disqualification breakdown
    if (lead.status === "DISQUALIFIED" && lead.disqualification_category) {
      const dqKey = dqCategoryMap[lead.disqualification_category];
      if (dqKey) {
        disqualification[dqKey]++;
      } else {
        disqualification.other++;
      }
    }
  }
  
  // Category counts using TENANT_FUNNEL_STAGES
  const categories = {
    received: leads.filter(l => statusSets.received?.has(l.status)).length,
    in_chat: leads.filter(l => statusSets.in_chat?.has(l.status)).length,
    qualified: leads.filter(l => statusSets.qualified?.has(l.status)).length,
    delivered: leads.filter(l => statusSets.delivered?.has(l.status)).length,
    not_qualified: leads.filter(l => statusSets.not_qualified?.has(l.status)).length,
  };
  
  return { categories, pipeline, disqualification };
}

// ============================================
// Tenant Stats
// ============================================

/**
 * Get funnel stats for a tenant
 * Uses admin client to bypass RLS
 */
export async function getTenantFunnelStats(tenantId: string): Promise<TenantFunnelStats | null> {
  const cacheKey = cacheKeys.tenantStats(tenantId);
  
  // Try cache first
  const cached = await cacheService.get<TenantFunnelStats>(cacheKey);
  if (cached) {
    logger.debug("[Stats] Returning cached tenant stats", { tenantId });
    return cached;
  }
  
  try {
    const supabase = createAdminClient();
    
    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .single();
    
    if (tenantError || !tenant) {
      logger.error("[Stats] Tenant not found", { tenantId, error: tenantError });
      return null;
    }
    
    // Get all lead_offers for this tenant with status and disqualification info
    const { data: leads, error: leadsError } = await supabase
      .from("lead_offers")
      .select("status, disqualification_category")
      .eq("tenant_id", tenantId);
    
    if (leadsError) {
      logger.error("[Stats] Error fetching leads", { tenantId, error: leadsError });
      return null;
    }
    
    const leadsData = (leads || []) as Array<{ status: string; disqualification_category: string | null }>;
    
    // Count leads using TENANT_FUNNEL_STAGES
    const { categories, pipeline, disqualification } = countLeadsByCategory(leadsData);
    
    // Get credit balance
    const { data: creditData } = await supabase
      .from("tenant_credit_balance")
      .select("current_balance")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    
    const creditBalance = (creditData as { current_balance: number } | null)?.current_balance || 0;
    
    // Get active offers count
    const { count: activeOffers } = await supabase
      .from("offers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE");
    
    // Calculate conversion rate
    const totalLeads = leadsData.length;
    const conversionRate = totalLeads > 0 
      ? Math.round((categories.delivered / totalLeads) * 100 * 100) / 100 
      : 0;
    
    const stats: TenantFunnelStats = {
      tenantId,
      tenantName: tenant.name,
      received: categories.received,
      inChat: categories.in_chat,
      qualified: categories.qualified,
      delivered: categories.delivered,
      notQualified: categories.not_qualified,
      totalLeads,
      conversionRate,
      creditBalance,
      activeOffers: activeOffers || 0,
      pipelineStats: pipeline,
      disqualificationBreakdown: disqualification,
    };
    
    // Cache the result
    await cacheService.set(cacheKey, stats, CacheTTL.STATS);
    
    logger.info("[Stats] Tenant stats calculated", { tenantId, totalLeads });
    
    return stats;
  } catch (error) {
    logger.error("[Stats] Error getting tenant stats", { tenantId, error });
    return null;
  }
}

// ============================================
// Offer Stats
// ============================================

/**
 * Get funnel stats for a specific offer
 */
export async function getOfferFunnelStats(offerId: string): Promise<OfferFunnelStats | null> {
  const cacheKey = `offer:${offerId}:stats`;
  
  // Try cache first
  const cached = await cacheService.get<OfferFunnelStats>(cacheKey);
  if (cached) {
    logger.debug("[Stats] Returning cached offer stats", { offerId });
    return cached;
  }
  
  try {
    const supabase = createAdminClient();
    
    // Get offer info
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id, name, status, approval_status, tenant_id")
      .eq("id", offerId)
      .single();
    
    if (offerError || !offer) {
      logger.error("[Stats] Offer not found", { offerId, error: offerError });
      return null;
    }
    
    // Get all lead_offers for this offer
    const { data: leads, error: leadsError } = await supabase
      .from("lead_offers")
      .select("status, disqualification_category, created_at")
      .eq("offer_id", offerId);
    
    if (leadsError) {
      logger.error("[Stats] Error fetching leads for offer", { offerId, error: leadsError });
      return null;
    }
    
    const leadsData = (leads || []) as Array<{ 
      status: string; 
      disqualification_category: string | null;
      created_at: string;
    }>;
    
    // Count leads using TENANT_FUNNEL_STAGES
    const { categories, pipeline, disqualification } = countLeadsByCategory(leadsData);
    
    // Calculate conversion rate
    const totalLeads = leadsData.length;
    const conversionRate = totalLeads > 0 
      ? Math.round((categories.delivered / totalLeads) * 100 * 100) / 100 
      : 0;
    
    // Get time range
    const sortedLeads = leadsData.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const firstLeadAt = sortedLeads[0]?.created_at || null;
    const lastLeadAt = sortedLeads[sortedLeads.length - 1]?.created_at || null;
    
    const stats: OfferFunnelStats = {
      offerId,
      offerName: offer.name,
      offerStatus: offer.status,
      approvalStatus: offer.approval_status,
      tenantId: offer.tenant_id,
      received: categories.received,
      inChat: categories.in_chat,
      qualified: categories.qualified,
      delivered: categories.delivered,
      notQualified: categories.not_qualified,
      totalLeads,
      conversionRate,
      pipelineStats: pipeline,
      disqualificationBreakdown: disqualification,
      firstLeadAt,
      lastLeadAt,
    };
    
    // Cache the result
    await cacheService.set(cacheKey, stats, CacheTTL.STATS);
    
    logger.info("[Stats] Offer stats calculated", { offerId, totalLeads });
    
    return stats;
  } catch (error) {
    logger.error("[Stats] Error getting offer stats", { offerId, error });
    return null;
  }
}

// ============================================
// Admin Stats
// ============================================

/**
 * Get dashboard stats for admin
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats | null> {
  const cacheKey = "admin:dashboard:stats";
  
  // Try cache first
  const cached = await cacheService.get<AdminDashboardStats>(cacheKey);
  if (cached) {
    logger.debug("[Stats] Returning cached admin stats");
    return cached;
  }
  
  try {
    const supabase = createAdminClient();
    
    // Run all queries in parallel
    const [
      totalLeadsResult,
      leadsTodayResult,
      activeTenantsResult,
      pendingApprovalsResult,
      unmappedAdsResult,
      lowCreditTenantsResult,
      responseTimesResult,
    ] = await Promise.allSettled([
      // Total leads (sum from all tenant stats)
      supabase.from("lead_offers").select("id", { count: "exact", head: true }),
      
      // Leads today
      supabase
        .from("lead_offers")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      
      // Active tenants
      supabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE"),
      
      // Pending approvals
      supabase
        .from("tenant_members")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING_APPROVAL"),
      
      // Unmapped ads (leads with PENDING_MAPPING status)
      supabase
        .from("lead_offers")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING_MAPPING"),
      
      // Low credit tenants
      supabase
        .from("tenant_credit_balance")
        .select("tenant_id")
        .lt("current_balance", 10),
      
      // Response times for avg calculation
      supabase
        .from("lead_offers")
        .select("created_at, first_response_at")
        .not("first_response_at", "is", null)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100),
    ]);
    
    // Extract values
    const totalLeads = totalLeadsResult.status === "fulfilled" ? (totalLeadsResult.value.count || 0) : 0;
    const leadsToday = leadsTodayResult.status === "fulfilled" ? (leadsTodayResult.value.count || 0) : 0;
    const activeTenants = activeTenantsResult.status === "fulfilled" ? (activeTenantsResult.value.count || 0) : 0;
    const pendingApprovals = pendingApprovalsResult.status === "fulfilled" ? (pendingApprovalsResult.value.count || 0) : 0;
    const unmappedAds = unmappedAdsResult.status === "fulfilled" ? (unmappedAdsResult.value.count || 0) : 0;
    const lowCreditTenants = lowCreditTenantsResult.status === "fulfilled" 
      ? (Array.isArray(lowCreditTenantsResult.value.data) ? lowCreditTenantsResult.value.data.length : 0) 
      : 0;
    
    // Calculate average response time
    let avgResponseTime = "N/A";
    if (responseTimesResult.status === "fulfilled" && responseTimesResult.value.data) {
      const responseTimes = (responseTimesResult.value.data as Array<{ created_at: string; first_response_at: string }>);
      const times = responseTimes
        .map((r) => {
          const created = new Date(r.created_at).getTime();
          const responded = new Date(r.first_response_at).getTime();
          return (responded - created) / 1000 / 60;
        })
        .filter((t) => t > 0 && t < 1440);
      
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        avgResponseTime = `${avg.toFixed(1)}min`;
      }
    }
    
    // Calculate lead ready rate
    const { count: leadReadyCount } = await supabase
      .from("lead_offers")
      .select("id", { count: "exact", head: true })
      .in("status", ["LEAD_READY", "SENT_TO_DEVELOPER"]);
    
    const leadReadyRate = totalLeads > 0 
      ? Math.round(((leadReadyCount || 0) / totalLeads) * 100) 
      : 0;
    
    // Get leads trend (last 30 days)
    const leadsTrend: Array<{ date: string; value: number }> = [];
    const daysAgo = 30;
    
    for (let i = daysAgo; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const { count } = await supabase
        .from("lead_offers")
        .select("id", { count: "exact", head: true })
        .gte("created_at", date.toISOString())
        .lt("created_at", nextDay.toISOString());
      
      leadsTrend.push({
        date: date.toLocaleDateString("es-AR", { month: "short", day: "numeric" }),
        value: count || 0,
      });
    }
    
    const stats: AdminDashboardStats = {
      totalLeads,
      leadsToday,
      activeTenants,
      pendingApprovals,
      leadReadyRate,
      unmappedAds,
      lowCreditTenants,
      avgResponseTime,
      leadsTrend,
    };
    
    // Cache the result
    await cacheService.set(cacheKey, stats, CacheTTL.STATS);
    
    logger.info("[Stats] Admin stats calculated", { totalLeads, activeTenants });
    
    return stats;
  } catch (error) {
    logger.error("[Stats] Error getting admin stats", { error });
    return null;
  }
}

// ============================================
// Multi-offer Stats
// ============================================

/**
 * Get stats for all offers of a tenant
 */
export async function getTenantOfferStats(tenantId: string): Promise<OfferFunnelStats[]> {
  const cacheKey = `tenant:${tenantId}:offer-stats`;
  
  // Try cache first
  const cached = await cacheService.get<OfferFunnelStats[]>(cacheKey);
  if (cached) {
    logger.debug("[Stats] Returning cached tenant offer stats", { tenantId });
    return cached;
  }
  
  try {
    const supabase = createAdminClient();
    
    // Get all offers for this tenant
    const { data: offers, error: offersError } = await supabase
      .from("offers")
      .select("id, name, status, approval_status, tenant_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    
    if (offersError || !offers) {
      logger.error("[Stats] Error fetching offers", { tenantId, error: offersError });
      return [];
    }
    
    // Get stats for each offer
    const statsPromises = offers.map((offer: { id: string }) => getOfferFunnelStats(offer.id));
    const statsResults = await Promise.allSettled(statsPromises);
    
    const stats = statsResults
      .filter((result): result is PromiseFulfilledResult<OfferFunnelStats | null> => 
        result.status === "fulfilled" && result.value !== null
      )
      .map(result => result.value as OfferFunnelStats);
    
    // Cache the result
    await cacheService.set(cacheKey, stats, CacheTTL.STATS);
    
    return stats;
  } catch (error) {
    logger.error("[Stats] Error getting tenant offer stats", { tenantId, error });
    return [];
  }
}

// ============================================
// Cache Invalidation
// ============================================

/**
 * Invalidate all stats caches for a tenant
 * Call this when leads are added/updated
 */
export async function invalidateTenantStats(tenantId: string): Promise<void> {
  await invalidateCache.tenantLeads(tenantId);
  logger.info("[Stats] Invalidated tenant stats cache", { tenantId });
}

/**
 * Invalidate all admin stats caches
 */
export async function invalidateAdminStats(): Promise<void> {
  await cacheService.del("admin:dashboard:stats");
  logger.info("[Stats] Invalidated admin stats cache");
}

/**
 * Invalidate offer stats cache
 */
export async function invalidateOfferStats(offerId: string): Promise<void> {
  await cacheService.del(`offer:${offerId}:stats`);
  logger.info("[Stats] Invalidated offer stats cache", { offerId });
}
