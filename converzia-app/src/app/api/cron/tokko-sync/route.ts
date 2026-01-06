import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { syncTokkoPublications, getTokkoConfig } from "@/lib/services/tokko";
import { withCronAuth } from "@/lib/security/cron-auth";
import { logger } from "@/lib/monitoring";

// ============================================
// Tokko Sync Cron Job
// Runs once daily at 3 AM UTC to sync offers from Tokko
// NOTE: On Hobby plan, crons can only run once per day
// ============================================

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  // SECURITY: Validate cron secret - REQUIRED
  const authError = withCronAuth(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const results: Array<{
    tenant_id: string;
    success: boolean;
    offers_synced: number;
    variants_synced: number;
    errors: string[];
  }> = [];

  try {
    // Get all active Tokko integrations
    const { data: integrationsRaw, error: fetchError } = await queryWithTimeout(
      supabase
        .from("tenant_integrations")
        .select("id, tenant_id, config")
        .eq("integration_type", "TOKKO")
        .eq("is_active", true),
      30000,
      "fetch active Tokko integrations"
    );
    
    const integrations = Array.isArray(integrationsRaw) ? integrationsRaw : [];

    if (fetchError) {
      logger.error("Error fetching Tokko integrations", { error: fetchError });
      return NextResponse.json(
        { error: "Failed to fetch integrations" },
        { status: 500 }
      );
    }

    if (integrations.length === 0) {
      logger.info("No active Tokko integrations found");
      return NextResponse.json({
        message: "No active Tokko integrations to sync",
        results: [],
      });
    }

    logger.info("Starting Tokko sync cron", {
      integrations_count: integrations.length,
    });

    // Sync each integration
    for (const integration of integrations) {
      const tenantId = (integration as any).tenant_id;
      const config = (integration as any).config;

      try {
        const result = await syncTokkoPublications(
          tenantId,
          config,
          false // Incremental sync
        );

        results.push({
          tenant_id: tenantId,
          success: result.success,
          offers_synced: result.offers_synced,
          variants_synced: result.variants_synced,
          errors: result.errors,
        });

        logger.info("Tokko sync completed for tenant", {
          tenant_id: tenantId,
          offers_synced: result.offers_synced,
          variants_synced: result.variants_synced,
        });
      } catch (error) {
        logger.exception("Error syncing tenant", error, { tenant_id: tenantId });
        results.push({
          tenant_id: tenantId,
          success: false,
          offers_synced: 0,
          variants_synced: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
        });
      }
    }

    const totalOffers = results.reduce((sum, r) => sum + r.offers_synced, 0);
    const totalVariants = results.reduce((sum, r) => sum + r.variants_synced, 0);
    const successCount = results.filter((r) => r.success).length;

    logger.info("Tokko sync cron completed", {
      total_tenants: integrations.length,
      success_count: successCount,
      total_offers_synced: totalOffers,
      total_variants_synced: totalVariants,
    });

    return NextResponse.json({
      message: "Tokko sync completed",
      summary: {
        tenants_processed: integrations.length,
        tenants_successful: successCount,
        total_offers_synced: totalOffers,
        total_variants_synced: totalVariants,
      },
      results,
    });
  } catch (error) {
    logger.exception("Tokko sync cron error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

