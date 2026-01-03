import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { syncTokkoPublications, getTokkoConfig, TokkoConfig } from "@/lib/services/tokko";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/monitoring";

// ============================================
// Tokko Sync API
// ============================================

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_id, force_full_sync } = body;

    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this tenant
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile for Tokko sync"
    );

    const isAdmin = !!(profile as any)?.is_converzia_admin;

    if (!isAdmin) {
      // Check if user is OWNER or ADMIN of the tenant
      const { data: membership } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .select("role")
          .eq("tenant_id", tenant_id)
          .eq("user_id", user.id)
          .eq("status", "ACTIVE")
          .single(),
        10000,
        "get tenant membership for Tokko sync"
      );

      if (!membership || !["OWNER", "ADMIN"].includes((membership as any).role)) {
        return NextResponse.json(
          { error: "No access to this tenant" },
          { status: 403 }
        );
      }
    }

    // Get Tokko config
    const config = await getTokkoConfig(tenant_id);
    if (!config) {
      return NextResponse.json(
        { error: "Tokko integration not configured for this tenant" },
        { status: 400 }
      );
    }

    // Perform sync
    logger.info("Starting Tokko sync", { tenant_id, force_full_sync });
    const result = await syncTokkoPublications(
      tenant_id,
      config,
      force_full_sync || false
    );

    logger.info("Tokko sync completed", {
      tenant_id,
      offers_synced: result.offers_synced,
      variants_synced: result.variants_synced,
      errors_count: result.errors.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.exception("Tokko sync error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

