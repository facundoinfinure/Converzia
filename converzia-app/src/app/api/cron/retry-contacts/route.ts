import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { retryContact, sendReactivation } from "@/lib/services/conversation";
import { withCronAuth } from "@/lib/security/cron-auth";
import { handleApiError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { LeadOfferWithRelations } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";

// ============================================
// Cron Job: Retry Contacts & Reactivations
// Runs every 2 hours via Vercel Cron
// ============================================

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // SECURITY: Validate cron secret - REQUIRED
  const authError = withCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();
    const now = new Date();

    // ==========================================
    // 1. Retry contacts that haven't responded
    // ==========================================

    const { data: contactsToRetry } = await queryWithTimeout(
      supabase
        .from("lead_offers")
        .select("id, contact_attempts")
        .in("status", ["CONTACTED", "TO_BE_CONTACTED"])
        .lt("contact_attempts", 3)
        .lte("next_attempt_at", now.toISOString())
        .order("created_at", { ascending: true })
        .limit(20),
      10000,
      "fetch contacts to retry"
    );

    let retryCount = 0;
    let retryErrors = 0;

    const contacts = (contactsToRetry as LeadOfferWithRelations[]) || [];
    if (contacts.length > 0) {
      logger.info(`Retrying ${contacts.length} contacts`);

      for (const leadOffer of contacts) {
        try {
          await retryContact(leadOffer.id);
          retryCount++;
        } catch (err) {
          logger.error(`Error retrying contact ${leadOffer.id}`, err);
          retryErrors++;
        }
      }
    }

    // ==========================================
    // 2. Send reactivation messages
    // ==========================================

    // Get leads in COOLING status for 3+ days with less than 3 reactivation attempts
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
        .limit(10),
      10000,
      "fetch leads to reactivate"
    );

    let reactivationCount = 0;
    let reactivationErrors = 0;

    const reactivations = (leadsToReactivate as LeadOfferWithRelations[]) || [];
    if (reactivations.length > 0) {
      logger.info(`Reactivating ${reactivations.length} leads`);

      for (const leadOffer of reactivations) {
        try {
          await sendReactivation(leadOffer.id);
          reactivationCount++;
        } catch (err) {
          logger.error(`Error reactivating ${leadOffer.id}`, err);
          reactivationErrors++;
        }
      }
    }

    // ==========================================
    // 3. Move stale leads to COOLING
    // ==========================================

    // Leads in CONTACTED/TO_BE_CONTACTED for 48+ hours with max attempts
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 48);

    const { data: staleLeads, error: staleError } = await queryWithTimeout(
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
      "move stale leads to COOLING"
    );

    const movedToCooling = Array.isArray(staleLeads) ? staleLeads.length : 0;

    return apiSuccess({
      retries: {
        processed: contacts.length,
        success: retryCount,
        errors: retryErrors,
      },
      reactivations: {
        processed: reactivations.length,
        success: reactivationCount,
        errors: reactivationErrors,
      },
      movedToCooling,
    }, `Procesados ${retryCount} reintentos y ${reactivationCount} reactivaciones`);
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error en el cron de reintentos de contacto",
      context: { operation: "retry_contacts_cron" },
    });
  }
}

