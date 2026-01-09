/**
 * Admin Stats API - Single Source of Truth
 * 
 * GET /api/admin/stats
 * 
 * Returns unified dashboard statistics for Converzia admins.
 * Uses the centralized stats service which:
 * - Uses admin client (bypasses RLS)
 * - Uses TENANT_FUNNEL_STAGES for consistent status groupings
 * - Implements caching
 * 
 * Query params:
 * - bypass_cache: Optional - set to "true" to bypass cache
 * - tenant_id: Optional - get stats for a specific tenant
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { 
  getAdminDashboardStats,
  getTenantFunnelStats, 
  invalidateAdminStats,
  type AdminDashboardStats,
  type TenantFunnelStats,
} from "@/lib/services/stats";
import { 
  handleApiError, 
  handleUnauthorized, 
  handleForbidden,
  apiSuccess, 
  ErrorCode 
} from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";
import { isAdminProfile } from "@/types/supabase-helpers";

export const runtime = "nodejs";
export const maxDuration = 60; // Admin stats may take longer

interface AdminStatsResponse {
  dashboard?: AdminDashboardStats;
  tenant?: TenantFunnelStats;
  cached?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");
    const bypassCache = searchParams.get("bypass_cache") === "true";

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

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

    if (!isAdmin) {
      logger.warn("[Admin Stats] Access denied - not admin", { userId: user.id });
      return handleForbidden("Acceso denegado - solo administradores");
    }

    // Invalidate cache if requested
    if (bypassCache) {
      await invalidateAdminStats();
    }

    const response: AdminStatsResponse = {};

    // If tenant_id specified, get stats for that tenant
    if (tenantId) {
      const tenantStats = await getTenantFunnelStats(tenantId);
      
      if (!tenantStats) {
        return handleApiError(new Error("Tenant not found"), {
          code: ErrorCode.NOT_FOUND,
          message: "Tenant no encontrado",
        });
      }
      
      response.tenant = tenantStats;
      
      logger.info("[Admin Stats] Tenant stats retrieved", { 
        tenantId, 
        totalLeads: tenantStats.totalLeads,
      });
      
      return apiSuccess(response);
    }

    // Get admin dashboard stats
    const dashboardStats = await getAdminDashboardStats();
    
    if (!dashboardStats) {
      return handleApiError(new Error("Failed to get admin stats"), {
        code: ErrorCode.DATABASE_ERROR,
        message: "Error al obtener estadísticas del admin",
      });
    }

    response.dashboard = dashboardStats;

    logger.info("[Admin Stats] Dashboard stats retrieved", { 
      totalLeads: dashboardStats.totalLeads,
      activeTenants: dashboardStats.activeTenants,
    });

    return apiSuccess(response);

  } catch (error) {
    logger.error("[Admin Stats] Error", { error });
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "GET /api/admin/stats" },
    });
  }
}
