import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";
import { isAdminProfile } from "@/types/supabase-helpers";
import { cacheService, cacheKeys, CacheTTL } from "@/lib/services/cache";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * GET /api/portal/leads/stats
 * 
 * Returns funnel stats for a tenant, bypassing RLS restrictions.
 * The RLS policy on lead_offers only allows seeing SENT_TO_DEVELOPER status,
 * which causes stats views to show 0 for other stages.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
      return handleValidationError("Missing tenant_id parameter");
    }

    // Use regular client for auth check
    const supabaseAuth = await createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

    // Use admin client to bypass RLS for data queries
    const supabase = createAdminClient();

    // Verify user has access to this tenant
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .single();

    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      5000,
      "get user profile for stats API"
    );
    const isAdmin = isAdminProfile(profile as { is_converzia_admin?: boolean } | null);

    if (!membership && !isAdmin) {
      logger.error("[API Stats] Access denied", { userId: user.id, tenantId });
      return handleForbidden("No tiene acceso a este tenant");
    }

    // Try to get from cache first
    const cacheKey = cacheKeys.tenantStats(tenantId);
    const cachedStats = await cacheService.get<{
      received: number;
      in_chat: number;
      qualified: number;
      delivered: number;
      not_qualified: number;
    }>(cacheKey);

    if (cachedStats) {
      logger.debug("[API Stats] Returning cached stats", { tenantId });
      return apiSuccess({ stats: cachedStats, cached: true });
    }

    // Count leads by status using admin client (bypasses RLS)
    // Query directly by tenant_id on lead_offers for more reliable counts
    const { data: leadCountsData, error: countsError } = await queryWithTimeout(
      supabase
        .from("lead_offers")
        .select("status")
        .eq("tenant_id", tenantId),
      10000,
      "lead counts by status"
    );

    if (countsError) {
      logger.error("[API Stats] Error counting leads", countsError);
      return handleApiError(countsError, {
        code: ErrorCode.DATABASE_ERROR,
        message: "Error al contar leads",
      });
    }

    const leads = Array.isArray(leadCountsData) ? leadCountsData as Array<{ status: string }> : [];

    // Count by category (matching the view logic)
    const stats = {
      received: leads.filter(l => 
        l.status === "PENDING_MAPPING" || l.status === "TO_BE_CONTACTED"
      ).length,
      in_chat: leads.filter(l => 
        l.status === "CONTACTED" || l.status === "ENGAGED" || l.status === "QUALIFYING"
      ).length,
      qualified: leads.filter(l => 
        l.status === "SCORED" || l.status === "LEAD_READY"
      ).length,
      delivered: leads.filter(l => 
        l.status === "SENT_TO_DEVELOPER"
      ).length,
      not_qualified: leads.filter(l => 
        l.status === "DISQUALIFIED" || l.status === "STOPPED" || l.status === "COOLING"
      ).length,
    };

    // Cache the stats
    await cacheService.set(cacheKey, stats, CacheTTL.STATS);

    logger.info("[API Stats] Stats calculated and cached", { tenantId, stats });

    return apiSuccess({ stats });

  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "GET /api/portal/leads/stats" },
    });
  }
}
