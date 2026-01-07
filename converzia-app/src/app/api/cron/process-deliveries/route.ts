import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { processDelivery } from "@/lib/services/delivery";
import { withCronAuth } from "@/lib/security/cron-auth";
import { handleApiError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { DeliveryWithRelations } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";

// ============================================
// Cron Job: Process Pending Deliveries
// Runs every 5 minutes via Vercel Cron
// ============================================

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max

export async function GET(request: NextRequest) {
  // SECURITY: Validate cron secret - REQUIRED
  const authError = withCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    // Get pending deliveries
    const { data: pendingDeliveries, error } = await queryWithTimeout(
      supabase
        .from("deliveries")
        .select("id, tenant_id, lead_id, retry_count")
        .eq("status", "PENDING")
        .lt("retry_count", 3) // Max 3 retries
        .order("created_at", { ascending: true })
        .limit(20), // Process in batches
      10000,
      "fetch pending deliveries"
    );

    if (error) {
      return handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "Error al obtener entregas pendientes",
        context: { operation: "process_deliveries_fetch" },
      });
    }

    const deliveries = (pendingDeliveries as DeliveryWithRelations[]) || [];
    if (deliveries.length === 0) {
      return apiSuccess({ processed: 0 }, "No hay entregas pendientes");
    }

    logger.info(`Processing ${deliveries.length} pending deliveries`);

    let successCount = 0;
    let errorCount = 0;

    // Process each delivery
    for (const delivery of deliveries) {
      try {
        await processDelivery(delivery.id);
        successCount++;
      } catch (err) {
        logger.error(`Error processing delivery ${delivery.id}`, err);
        errorCount++;

        // Increment retry count
        await queryWithTimeout(
          supabase
            .from("deliveries")
            .update({
              retry_count: delivery.retry_count + 1,
              error_message: err instanceof Error ? err.message : "Unknown error",
            })
            .eq("id", delivery.id),
          10000,
          "increment delivery retry count"
        );
      }
    }

    return apiSuccess({
      processed: deliveries.length,
      success: successCount,
      errors: errorCount,
    }, `Procesadas ${successCount}/${deliveries.length} entregas`);
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error en el cron de procesamiento de entregas",
      context: { operation: "process_deliveries_cron" },
    });
  }
}

