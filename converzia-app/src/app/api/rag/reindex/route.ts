import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { reindexSource, ingestFromUrl, ingestManualContent } from "@/lib/services/rag";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { isAdminProfile } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";
import { validateBody, ragReindexBodySchema } from "@/lib/validation/schemas";

// ============================================
// RAG Reindex API
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated and is Converzia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para reindexar contenido RAG");
    }

    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile for RAG reindex"
    );

    if (!isAdminProfile(profile as { is_converzia_admin?: boolean } | null)) {
      return handleForbidden("Solo administradores pueden reindexar contenido RAG");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, ragReindexBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { source_id } = bodyValidation.data;

    // Reindex the source (source_id is required)
    if (!source_id) {
      return handleValidationError(new Error("source_id is required"), {
        field: "source_id",
      });
    }
    
    const result = await reindexSource(source_id);

    if (result.success) {
      return apiSuccess(null, "Contenido reindexado correctamente");
    } else {
      return handleApiError(new Error(result.error || "Reindex failed"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: result.error || "Error al reindexar el contenido",
        context: { source_id },
      });
    }
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al reindexar el contenido RAG",
      context: { operation: "rag_reindex" },
    });
  }
}

