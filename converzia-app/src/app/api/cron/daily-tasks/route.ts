import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { processDelivery } from "@/lib/services/delivery";
import { retryContact, sendReactivation } from "@/lib/services/conversation";
import { withCronAuth } from "@/lib/security/cron-auth";
import { handleApiError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { DeliveryWithRelations, LeadOfferWithRelations } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";

// ============================================
// Cron Job: Daily Tasks (Combined)
// Runs once daily at 2 AM UTC - processes deliveries, retries, reactivations, and credit alerts
// NOTE: On Hobby plan, crons can only run once per day
// ============================================

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // SECURITY: Validate cron secret - REQUIRED
  const authError = withCronAuth(request);
  if (authError) return authError;

  const results = {
    deliveries: { processed: 0, success: 0, errors: 0 },
    retries: { processed: 0, success: 0, errors: 0 },
    reactivations: { processed: 0, success: 0, errors: 0 },
    movedToCooling: 0,
  };

  try {
    const supabase = createAdminClient();
    const now = new Date();

    // ==========================================
    // 1. Process Pending Deliveries
    // ==========================================

    const { data: pendingDeliveries } = await queryWithTimeout(
      supabase
        .from("deliveries")
        .select("id, tenant_id, lead_id, retry_count")
        .eq("status", "PENDING")
        .lt("retry_count", 3)
        .order("created_at", { ascending: true })
        .limit(50),
      10000,
      "fetch pending deliveries for daily tasks"
    );

    const deliveries = (pendingDeliveries as DeliveryWithRelations[]) || [];
    if (deliveries.length > 0) {
      logger.info(`Processing ${deliveries.length} pending deliveries`);
      results.deliveries.processed = deliveries.length;

      for (const delivery of deliveries) {
        try {
          await processDelivery(delivery.id);
          results.deliveries.success++;
        } catch (err) {
          logger.error(`Error processing delivery ${delivery.id}`, err);
          results.deliveries.errors++;

          await queryWithTimeout(
            supabase
              .from("deliveries")
              .update({
                retry_count: delivery.retry_count + 1,
                error_message: err instanceof Error ? err.message : "Unknown error",
              })
              .eq("id", delivery.id),
            10000,
            "increment delivery retry count"
          );
        }
      }
    }

    // ==========================================
    // 2. Retry Contacts
    // ==========================================

    const { data: contactsToRetry } = await queryWithTimeout(
      supabase
        .from("lead_offers")
        .select("id, contact_attempts")
        .in("status", ["CONTACTED", "TO_BE_CONTACTED"])
        .lt("contact_attempts", 3)
        .lte("next_attempt_at", now.toISOString())
        .order("created_at", { ascending: true })
        .limit(30),
      10000,
      "fetch contacts to retry for daily tasks"
    );

    const contacts = (contactsToRetry as LeadOfferWithRelations[]) || [];
    if (contacts.length > 0) {
      logger.info(`Retrying ${contacts.length} contacts`);
      results.retries.processed = contacts.length;

      for (const leadOffer of contacts) {
        try {
          await retryContact(leadOffer.id);
          results.retries.success++;
        } catch (err) {
          logger.error(`Error retrying contact ${leadOffer.id}`, err);
          results.retries.errors++;
        }
      }
    }

    // ==========================================
    // 3. Send Reactivations (COOLING leads)
    // ==========================================

    const coolingDate = new Date();
    coolingDate.setDate(coolingDate.getDate() - 3);

    const { data: leadsToReactivate } = await queryWithTimeout(
      supabase
        .from("lead_offers")
        .select("id, reactivation_count")
        .eq("status", "COOLING")
        .lt("reactivation_count", 3)
        .lte("status_changed_at", coolingDate.toISOString())
        .order("status_changed_at", { ascending: true })
        .limit(20),
      10000,
      "fetch leads to reactivate for daily tasks"
    );

    const reactivations = (leadsToReactivate as LeadOfferWithRelations[]) || [];
    if (reactivations.length > 0) {
      logger.info(`Reactivating ${reactivations.length} leads`);
      results.reactivations.processed = reactivations.length;

      for (const leadOffer of reactivations) {
        try {
          await sendReactivation(leadOffer.id);
          results.reactivations.success++;
        } catch (err) {
          logger.error(`Error reactivating ${leadOffer.id}`, err);
          results.reactivations.errors++;
        }
      }
    }

    // ==========================================
    // 4. Move Stale Leads to COOLING
    // ==========================================

    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 48);

    const { data: staleLeads } = await queryWithTimeout(
      supabase
        .from("lead_offers")
        .update({
          status: "COOLING",
          status_changed_at: now.toISOString(),
          billing_eligibility: "NOT_CHARGEABLE_INCOMPLETE",
          billing_notes: "No response after 48 hours",
        })
        .in("status", ["CONTACTED", "TO_BE_CONTACTED"])
        .gte("contact_attempts", 3)
        .lte("created_at", staleDate.toISOString())
        .select("id"),
      10000,
      "move stale leads to COOLING for daily tasks"
    );

    results.movedToCooling = Array.isArray(staleLeads) ? staleLeads.length : 0;

    // ==========================================
    // 5. Credit Alerts (runs daily at 2 AM UTC)
    // ==========================================
    const creditAlerts = { sent: 0, errors: 0 };
      // Check tenants with low credits using the credit balance view
      const { data: lowCreditTenants } = await queryWithTimeout(
        supabase
          .from("tenant_credit_balance")
          .select(`
            tenant_id,
            current_balance,
            tenants:tenant_id (
              id,
              name,
              contact_email,
              min_credits
            )
          `)
          .lt("current_balance", 10),
        10000,
        "fetch tenants with low credits for daily tasks"
      );

      interface LowCreditTenant {
        tenant_id: string;
        current_balance: number;
        tenants: {
          id: string;
          name: string;
          contact_email: string | null;
          min_credits?: number;
        } | null;
      }
      
      const tenants = (lowCreditTenants as LowCreditTenant[]) || [];
      if (tenants.length > 0) {
        logger.info(`Sending credit alerts to ${tenants.length} tenants`);
        
        for (const item of tenants) {
          const tenant = item.tenants;
          if (!tenant) continue;
          
          try {
            // Log event
            await queryWithTimeout(
              supabase.from("lead_events").insert({
                tenant_id: item.tenant_id,
                event_type: "MANUAL_ACTION",
                details: {
                  current_balance: item.current_balance,
                  tenant_name: tenant.name,
                  action: "CREDIT_ALERT",
                  alert_type: item.current_balance === 0 ? "ZERO_CREDITS" : "LOW_CREDITS",
                },
                actor_type: "SYSTEM",
              }),
              10000,
              "insert credit alert event"
            );
            
            // Send email notification
            try {
              const { sendLowCreditsAlert } = await import('@/lib/services/email');
              if (tenant.contact_email) {
                await sendLowCreditsAlert(
                  tenant.contact_email,
                  tenant.name,
                  item.current_balance
                );
                logger.info(`Low credits alert sent to ${tenant.name}`, { tenantId: item.tenant_id, balance: item.current_balance });
              }
            } catch (emailError) {
              logger.error(`Failed to send low credits email to ${tenant.name}`, emailError, { tenantId: item.tenant_id });
            }
            creditAlerts.sent++;
          } catch (err) {
            logger.error(`Error sending credit alert to tenant ${item.tenant_id}`, err);
            creditAlerts.errors++;
          }
        }
      }

    logger.info("Daily tasks completed", { ...results, creditAlerts });
    return apiSuccess({ ...results, creditAlerts }, "Tareas diarias completadas");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error en el cron de tareas diarias",
      context: { operation: "daily_tasks_cron", partialResults: results },
    });
  }
}
