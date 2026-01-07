import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { searchKnowledge } from "@/lib/services/rag";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { isAdminProfile } from "@/types/supabase-helpers";
import { validateBody, testingRagBodySchema } from "@/lib/validation/schemas";

// ============================================
// Testing RAG API
// Allows admins to test RAG search
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
      return handleUnauthorized("Debes iniciar sesión para probar RAG");
    }

    // Verify admin access
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile for RAG testing"
    );

    if (!isAdminProfile(profile as { is_converzia_admin?: boolean } | null)) {
      return handleForbidden("Solo administradores pueden probar RAG");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, testingRagBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { tenant_id, offer_id, query, limit = 5 } = bodyValidation.data;

    try {
      const chunks = await searchKnowledge(
        query,
        tenant_id,
        offer_id || undefined,
        10 // Get more results for testing
      );

      return apiSuccess({
        chunks: chunks.map((c) => ({
          content: c.content,
          similarity: c.similarity,
          document_id: c.document_id,
          chunk_id: c.chunk_id,
          metadata: c.metadata,
        })),
        query,
        tenant_id,
        offer_id: offer_id || null,
      });
    } catch (error) {
      return handleApiError(error, {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "Error en la búsqueda RAG",
        context: { query, tenant_id, offer_id },
      });
    }
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al procesar la solicitud de testing RAG",
      context: { operation: "rag_testing" },
    });
  }
}

