import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { syncTokkoPublications, getTokkoConfig, TokkoConfig } from "@/lib/services/tokko";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/monitoring";
import { validateBody, tokkoSyncBodySchema } from "@/lib/validation/schemas";
import { isAdminProfile, type MembershipWithRole } from "@/types/supabase-helpers";

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
      return handleUnauthorized("Debes iniciar sesión para sincronizar Tokko");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, tokkoSyncBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { tenant_id, force_full_sync = false } = bodyValidation.data;

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

    const isAdmin = isAdminProfile(profile as { is_converzia_admin?: boolean } | null);

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

      const typedMembership = membership as MembershipWithRole | null;
      if (!typedMembership || !["OWNER", "ADMIN"].includes(typedMembership.role)) {
        return handleForbidden("No tienes acceso a este tenant");
      }
    }

    // Get Tokko config
    const config = await getTokkoConfig(tenant_id);
    if (!config) {
      return handleApiError(new Error("Tokko not configured"), {
        code: ErrorCode.NOT_FOUND,
        status: 404,
        message: "Tokko no está configurado para este tenant",
        context: { tenant_id },
      });
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

    return apiSuccess(result, "Sincronización de Tokko completada");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error en la sincronización de Tokko",
      context: { operation: "tokko_sync" },
    });
  }
}

