/**
 * Portal Stats API - Single Source of Truth
 * 
 * GET /api/portal/stats
 * 
 * Returns unified funnel statistics for the authenticated tenant.
 * Uses the centralized stats service which:
 * - Uses admin client (bypasses RLS)
 * - Uses TENANT_FUNNEL_STAGES for consistent status groupings
 * - Implements caching
 * 
 * Query params:
 * - tenant_id: Required - the tenant to get stats for
 * - offer_id: Optional - get stats for a specific offer
 * - bypass_cache: Optional - set to "true" to bypass cache
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { 
  getTenantFunnelStats, 
  getOfferFunnelStats,
  getTenantOfferStats,
  invalidateTenantStats,
  type TenantFunnelStats,
  type OfferFunnelStats,
} from "@/lib/services/stats";
import { 
  handleApiError, 
  handleUnauthorized, 
  handleForbidden, 
  handleValidationError,
  apiSuccess, 
  ErrorCode 
} from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";
import { isAdminProfile } from "@/types/supabase-helpers";

export const runtime = "nodejs";
export const maxDuration = 30;

interface PortalStatsResponse {
  tenant: TenantFunnelStats;
  offers?: OfferFunnelStats[];
  offer?: OfferFunnelStats;
  cached?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");
    const offerId = searchParams.get("offer_id");
    const bypassCache = searchParams.get("bypass_cache") === "true";
    const includeOffers = searchParams.get("include_offers") === "true";

    if (!tenantId) {
      return handleValidationError("Missing tenant_id parameter");
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

    // Check if user has access to this tenant
    const { data: membership } = await queryWithTimeout(
      supabase
        .from("tenant_members")
        .select("role, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .single(),
      5000,
      "check membership"
    );

    // Check if user is a Converzia admin
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      5000,
      "get user profile"
    );
    const isAdmin = isAdminProfile(profile as { is_converzia_admin?: boolean } | null);

    if (!membership && !isAdmin) {
      logger.warn("[Portal Stats] Access denied", { userId: user.id, tenantId });
      return handleForbidden("No tiene acceso a este tenant");
    }

    // Invalidate cache if requested
    if (bypassCache) {
      await invalidateTenantStats(tenantId);
    }

    // If specific offer requested, get offer stats
    if (offerId) {
      const offerStats = await getOfferFunnelStats(offerId);
      
      if (!offerStats) {
        return handleValidationError("Offer not found");
      }
      
      // Verify offer belongs to this tenant
      if (offerStats.tenantId !== tenantId) {
        return handleForbidden("Offer does not belong to this tenant");
      }
      
      // Also get tenant stats for context
      const tenantStats = await getTenantFunnelStats(tenantId);
      
      if (!tenantStats) {
        return handleApiError(new Error("Failed to get tenant stats"), {
          code: ErrorCode.DATABASE_ERROR,
          message: "Error al obtener estadísticas del tenant",
        });
      }
      
      const response: PortalStatsResponse = {
        tenant: tenantStats,
        offer: offerStats,
      };
      
      return apiSuccess(response);
    }

    // Get tenant stats
    const tenantStats = await getTenantFunnelStats(tenantId);
    
    if (!tenantStats) {
      return handleApiError(new Error("Failed to get tenant stats"), {
        code: ErrorCode.DATABASE_ERROR,
        message: "Error al obtener estadísticas del tenant",
      });
    }

    const response: PortalStatsResponse = {
      tenant: tenantStats,
    };

    // Include per-offer stats if requested
    if (includeOffers) {
      const offerStats = await getTenantOfferStats(tenantId);
      response.offers = offerStats;
    }

    logger.info("[Portal Stats] Stats retrieved", { 
      tenantId, 
      totalLeads: tenantStats.totalLeads,
      offerId: offerId || "all",
    });

    return apiSuccess(response);

  } catch (error) {
    logger.error("[Portal Stats] Error", { error });
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "GET /api/portal/stats" },
    });
  }
}
