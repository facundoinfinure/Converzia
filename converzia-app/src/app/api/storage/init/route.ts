import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { ensureRagBucketExists, initializeTenantStorage, initializeOfferStorage } from "@/lib/services/storage";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { isAdminProfile } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";
import { validateBody, storageInitBodySchema } from "@/lib/validation/schemas";

// ============================================
// Storage Initialization API
// ============================================

/**
 * POST /api/storage/init
 * Initializes storage for tenant/offer before upload
 * 
 * Body: { tenant_id: string, offer_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated and is Converzia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para inicializar storage");
    }

    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "verificar perfil de admin"
    );

    if (!isAdminProfile(profile as { is_converzia_admin?: boolean } | null)) {
      return handleForbidden("Solo administradores pueden inicializar storage");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, storageInitBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { tenant_id, offer_id } = bodyValidation.data;

    // Initialize storage
    let result;
    if (offer_id) {
      // Initialize offer storage (includes tenant folder)
      result = await initializeOfferStorage(tenant_id, offer_id);
    } else {
      // Initialize tenant storage only
      result = await initializeTenantStorage(tenant_id);
    }

    if (!result.success) {
      return handleApiError(new Error(result.error || "Storage init failed"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: result.error || "Error al inicializar storage",
        context: { tenant_id, offer_id },
      });
    }

    return apiSuccess(null, "Storage inicializado correctamente");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al inicializar storage",
      context: { operation: "storage_init" },
    });
  }
}

/**
 * GET /api/storage/init
 * Ensures the RAG bucket exists (used for health checks)
 */
export async function GET() {
  try {
    const result = await ensureRagBucketExists();
    
    if (!result.success) {
      return handleApiError(new Error(result.error || "Bucket check failed"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: result.error || "Error al verificar storage",
        context: { bucket: "rag-documents" },
      });
    }

    return apiSuccess({ bucket: "rag-documents" }, "Storage verificado correctamente");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al verificar storage",
      context: { operation: "storage_check" },
    });
  }
}








