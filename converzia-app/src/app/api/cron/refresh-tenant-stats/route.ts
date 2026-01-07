import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import { unsafeRpc } from "@/lib/supabase/unsafe-rpc";
import { withCronAuth } from "@/lib/security/cron-auth";
import { handleApiError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";

// ============================================
// Cron Job: Refresh Tenant Stats Materialized View
// Runs daily at 2 AM UTC to refresh tenant_stats_mv
// ============================================

export const runtime = "nodejs";
export const maxDuration = 60; // 1 minute max

export async function GET(request: NextRequest) {
  // SECURITY: Validate cron secret - REQUIRED
  const authError = withCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    logger.info("Refreshing tenant_stats_mv materialized view");

    const { error } = await rpcWithTimeout<void>(
      unsafeRpc<void>(supabase, "refresh_tenant_stats_mv"),
      60000, // 60 second timeout for materialized view refresh
      "refresh_tenant_stats_mv",
      false // Don't retry - if it fails, we'll try again tomorrow
    );

    if (error) {
      return handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "Error al refrescar la vista materializada de estadísticas",
        context: { operation: "refresh_tenant_stats_mv" },
      });
    }

    logger.info("Successfully refreshed tenant_stats_mv");

    return apiSuccess({
      refreshed_at: new Date().toISOString(),
    }, "Vista materializada de tenant stats refrescada correctamente");
  } catch (error: unknown) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error en el cron de refresh de tenant stats",
      context: { operation: "refresh_tenant_stats_cron" },
    });
  }
}
