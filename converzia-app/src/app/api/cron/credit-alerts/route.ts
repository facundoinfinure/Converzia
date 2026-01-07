import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { withCronAuth } from "@/lib/security/cron-auth";
import { logger } from "@/lib/utils/logger";
import { handleApiError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { sendLowCreditsAlert } from "@/lib/services/email";

// ============================================
// Cron Job: Credit Alerts
// Runs daily at 9am to notify tenants with low credits
// ============================================

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // SECURITY: Validate cron secret - REQUIRED
  const authError = withCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    // Get tenants with low credits
    const { data: lowCreditTenants, error } = await queryWithTimeout(
      supabase
        .from("tenant_credit_balance")
        .select(`
          tenant_id,
          current_balance,
          tenants:tenant_id (
            name,
            contact_email
          )
        `)
        .lt("current_balance", 10),
      10000,
      "fetch tenants with low credits",
      false // Don't retry credit balance queries
    );

    if (error) {
      return handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "Error al obtener tenants con créditos bajos",
        context: { operation: "credit_alerts_fetch" },
      });
    }

    interface LowCreditTenantRow {
      tenant_id: string;
      current_balance: number;
      tenants?: {
        name: string;
        contact_email: string | null;
      } | Array<{
        name: string;
        contact_email: string | null;
      }> | null;
    }
    const tenants = (lowCreditTenants || []) as LowCreditTenantRow[];
    if (tenants.length === 0) {
      return apiSuccess({ alerted: 0 }, "No hay tenants con créditos bajos");
    }

    logger.info("Found tenants with low credits", { count: tenants.length });

    // In production, send emails to tenant admins
    // For now, just log and track in events
    let alertCount = 0;

    for (const tenant of tenants) {
      const tenantInfo = Array.isArray(tenant.tenants) ? tenant.tenants[0] : tenant.tenants;

      // Log event
      await queryWithTimeout(
        supabase.from("lead_events").insert({
          tenant_id: tenant.tenant_id,
          event_type: "MANUAL_ACTION",
          details: {
            current_balance: tenant.current_balance,
            tenant_name: tenantInfo?.name,
            action: "CREDIT_ALERT",
            alert_type: tenant.current_balance === 0 ? "ZERO_CREDITS" : "LOW_CREDITS",
          },
          actor_type: "SYSTEM",
        }),
        10000,
        "insert credit alert event"
      );

      // Send email notification if contact email is available
      if (tenantInfo?.contact_email) {
        try {
          await sendLowCreditsAlert(
            tenantInfo.contact_email,
            tenantInfo.name || "tu cuenta",
            tenant.current_balance
          );
          logger.info("Low credits email sent", {
            tenant_id: tenant.tenant_id,
            email: tenantInfo.contact_email,
            balance: tenant.current_balance,
          });
        } catch (emailError) {
          logger.error("Failed to send low credits email", emailError, {
            tenant_id: tenant.tenant_id,
            email: tenantInfo.contact_email,
          });
        }
      } else {
        logger.warn("No contact email for tenant", { tenant_id: tenant.tenant_id });
      }

      alertCount++;
    }

    return apiSuccess({
      alerted: alertCount,
      details: tenants.map((t: { tenant_id: string; current_balance: number }) => ({
        tenant_id: t.tenant_id,
        balance: t.current_balance,
      })),
    }, `Se alertó a ${alertCount} tenants con créditos bajos`);
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error en el cron de alertas de créditos",
      context: { operation: "credit_alerts_cron" },
    });
  }
}

