import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logIntegrationChange } from "@/lib/monitoring/audit";
import { handleApiError, handleUnauthorized, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";

// POST /api/integrations/meta/disconnect - Disconnect Meta Ads integration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para desconectar Meta Ads");
    }

    // Find and delete the global Meta Ads integration
    const { error: deleteError } = await supabase
      .from("tenant_integrations")
      .delete()
      .eq("integration_type", "META_ADS")
      .is("tenant_id", null);

    if (deleteError) {
      return handleApiError(deleteError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo desconectar Meta Ads",
        context: { userId: user.id },
      });
    }

    // Log audit event
    await logIntegrationChange(
      user.id,
      null, // Global integration
      "META_ADS",
      "integration_disconnected",
      { integration_type: "META_ADS" },
      request
    );

    return apiSuccess(null, "Meta Ads desconectado correctamente");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al desconectar Meta Ads",
      context: { operation: "meta_disconnect" },
    });
  }
}

