import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTenantApprovalEmail } from "@/lib/services/email";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { handleApiError, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";
import { validateBody, tenantNotifyApprovalBodySchema } from "@/lib/validation/schemas";

// ============================================
// Tenant Approval Notification API
// ============================================

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate request body
    const bodyValidation = await validateBody(request, tenantNotifyApprovalBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { tenant_id, tenant_name, emails, action, message } = bodyValidation.data;

    // Send emails
    const results = await Promise.allSettled(
      emails.map((email: string) => sendTenantApprovalEmail(email, tenant_name))
    );

    const successCount = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const errors = results
      .filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success))
      .map((r) => {
        if (r.status === "rejected") {
          return r.reason instanceof Error ? r.reason.message : String(r.reason);
        }
        return r.value.error || "Unknown error";
      });

    // Create in-app notification event
    const supabase = createAdminClient();
    try {
      await supabase.from("lead_events").insert({
        tenant_id,
        event_type: "SYSTEM_NOTIFICATION",
        details: {
          type: "TENANT_APPROVED",
          tenant_name,
          emails_sent: successCount,
        },
        actor_type: "SYSTEM",
      });
    } catch (eventError) {
      logger.error("Error creating notification event", eventError, { tenant_id, tenant_name });
    }

    return apiSuccess({
      emails_sent: successCount,
      total: emails.length,
      errors: errors.length > 0 ? errors : undefined,
    }, `${successCount} emails enviados correctamente`);
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al enviar notificaciones de aprobación",
      context: { operation: "notify_tenant_approval" },
    });
  }
}

