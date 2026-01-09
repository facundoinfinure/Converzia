import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";
import { isAdminProfile } from "@/types/supabase-helpers";
import { getTenantFunnelStats } from "@/lib/services/stats";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * GET /api/portal/leads/stats
 * 
 * Returns funnel stats for a tenant using the centralized stats service.
 * This endpoint delegates to the stats service for consistent data.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
      return handleValidationError("Missing tenant_id parameter");
    }

    // Use regular client for auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

    // Verify user has access to this tenant
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

    // Use centralized stats service
    const tenantStats = await getTenantFunnelStats(tenantId);
    
    if (!tenantStats) {
      return handleApiError(new Error("Failed to get tenant stats"), {
        code: ErrorCode.DATABASE_ERROR,
        message: "Error al obtener estadísticas del tenant",
      });
    }

    // Return stats in the expected format for backward compatibility
    const stats = {
      received: tenantStats.received,
      in_chat: tenantStats.inChat,
      qualified: tenantStats.qualified,
      delivered: tenantStats.delivered,
      not_qualified: tenantStats.notQualified,
    };

    logger.info("[API Stats] Stats retrieved", { tenantId, stats });

    return apiSuccess({ stats });

  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "GET /api/portal/leads/stats" },
    });
  }
}
