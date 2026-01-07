import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout, rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { isAdminProfile } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logGdprDeletion } from "@/lib/monitoring/audit";
import { validateBody, gdprDeleteBodySchema } from "@/lib/validation/schemas";
import { z } from "zod";
import { unsafeRpc } from "@/lib/supabase/unsafe-rpc";

// ============================================
// GDPR Right to Erasure (Delete) Endpoint
// Allows deletion of lead PII data
// ============================================

export async function POST(request: NextRequest) {
  // Rate limiting for heavy operations
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.heavy);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para realizar esta acción");
    }

    // Check if user is Converzia admin (only admins can delete PII)
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "check admin status for GDPR delete"
    );

    if (!isAdminProfile(profile as { is_converzia_admin?: boolean } | null)) {
      return handleForbidden("Solo administradores de Converzia pueden eliminar datos PII");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, gdprDeleteBodySchema.extend({
      reason: z.string().min(1, 'Reason is required for audit trail'),
    }));
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { lead_id, reason } = bodyValidation.data;

    // Get lead data before deletion for audit log
    type LeadPiiData = { id: string; phone: string | null; full_name: string | null; email: string | null; tenant_id: string };
    const { data: leadBeforeDelete } = await queryWithTimeout(
      admin
        .from("leads")
        .select("id, phone, full_name, email, tenant_id")
        .eq("id", lead_id)
        .single(),
      10000,
      "get lead before GDPR deletion"
    ) as { data: LeadPiiData | null };

    // Call the GDPR deletion function
    const { data, error } = await rpcWithTimeout<{ success: boolean }>(
      unsafeRpc<{ success: boolean }>(admin, "delete_lead_pii", {
        p_lead_id: lead_id,
        p_reason: reason,
        p_deleted_by: user.id,
      }),
      30000, // Longer timeout for deletion
      "execute GDPR lead deletion",
      true // Enable retry
    );

    if (error) {
      return handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo eliminar los datos del lead",
        context: { lead_id, reason, deleted_by: user.id },
        sendToSentry: true, // GDPR operations are critical
      });
    }

    // Log the deletion for audit
    logger.info("GDPR: Lead PII deleted", {
      lead_id,
      reason,
      deleted_by: user.id,
      deleted_at: new Date().toISOString(),
    });

    // Log audit event
    if (leadBeforeDelete) {
      await logGdprDeletion(
        user.id,
        lead_id,
        reason,
        {
          phone: leadBeforeDelete.phone,
          full_name: leadBeforeDelete.full_name,
          email: leadBeforeDelete.email,
          tenant_id: leadBeforeDelete.tenant_id,
        },
        request
      );
    }

    return apiSuccess(
      { lead_id },
      "Datos PII del lead eliminados correctamente"
    );
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al eliminar los datos",
      context: { operation: "gdpr_delete" },
    });
  }
}

// GET endpoint to check deletion status
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return handleUnauthorized("Debes iniciar sesión para consultar el estado de eliminación");
  }

  const { searchParams } = new URL(request.url);
  const lead_id = searchParams.get("lead_id");

  if (!lead_id) {
    return handleValidationError(new Error("lead_id missing"), {
      validationError: "El parámetro lead_id es requerido",
    });
  }

  // Check if lead exists and if PII was deleted
  const { data: lead } = await queryWithTimeout(
    supabase
      .from("leads")
      .select("id, phone, full_name, opted_out, opted_out_at, opt_out_reason")
      .eq("id", lead_id)
      .single(),
    10000,
    "check lead deletion status"
  );

  if (!lead) {
    return handleApiError(new Error("Lead not found"), {
      code: ErrorCode.NOT_FOUND,
      status: 404,
      message: "No se encontró el lead solicitado",
      context: { lead_id },
    });
  }

  // Check if lead data was anonymized
  const typedLead = lead as {
    phone?: string;
    full_name?: string | null;
    opted_out?: boolean;
    opted_out_at?: string | null;
    opt_out_reason?: string | null;
  };
  
  const isDeleted = typedLead.phone?.startsWith("DELETED_") || 
                    typedLead.full_name === "[ELIMINADO]";

  return NextResponse.json({
    lead_id,
    pii_deleted: isDeleted,
    opted_out: typedLead.opted_out,
    opted_out_at: typedLead.opted_out_at,
    reason: typedLead.opt_out_reason,
  });
}

