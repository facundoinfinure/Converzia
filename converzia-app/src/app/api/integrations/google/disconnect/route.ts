import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateBody, googleDisconnectBodySchema } from "@/lib/validation/schemas";
import { logIntegrationChange } from "@/lib/monitoring/audit";
import { handleApiError, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";

// ============================================
// Google OAuth - Disconnect Account
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const bodyValidation = await validateBody(request, googleDisconnectBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { tenant_id } = bodyValidation.data;

    const supabase = await createClient();

    // Clear OAuth tokens from integration
    const { error } = await supabase
      .from("tenant_integrations")
      .update({
        oauth_tokens: null,
        status: "PENDING_SETUP",
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id)
      .eq("integration_type", "GOOGLE_SHEETS");

    if (error) {
      return handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "Error al desconectar cuenta de Google",
        context: { tenant_id },
      });
    }

    // Get user for audit log
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await logIntegrationChange(
        user.id,
        tenant_id,
        "GOOGLE_SHEETS",
        "integration_disconnected",
        { integration_type: "GOOGLE_SHEETS" },
        request
      );
    }

    return apiSuccess(null, "Cuenta de Google desconectada correctamente");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al desconectar cuenta de Google",
      context: { operation: "google_disconnect" },
    });
  }
}

