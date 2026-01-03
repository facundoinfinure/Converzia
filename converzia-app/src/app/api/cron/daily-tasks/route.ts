import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { processDelivery } from "@/lib/services/delivery";
import { retryContact, sendReactivation } from "@/lib/services/conversation";
import { withCronAuth } from "@/lib/security/cron-auth";

// ============================================
// Cron Job: Daily Tasks (Combined)
// Runs every 5 minutes - processes deliveries, retries, reactivations, and credit alerts
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

    const deliveries = (pendingDeliveries as any) || [];
    if (deliveries.length > 0) {
      console.log(`Processing ${deliveries.length} pending deliveries`);
      results.deliveries.processed = deliveries.length;

      for (const delivery of deliveries) {
        try {
          await processDelivery(delivery.id);
          results.deliveries.success++;
        } catch (err) {
          console.error(`Error processing delivery ${delivery.id}:`, err);
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

    const contacts = (contactsToRetry as any) || [];
    if (contacts.length > 0) {
      console.log(`Retrying ${contacts.length} contacts`);
      results.retries.processed = contacts.length;

      for (const leadOffer of contacts) {
        try {
          await retryContact(leadOffer.id);
          results.retries.success++;
        } catch (err) {
          console.error(`Error retrying contact ${leadOffer.id}:`, err);
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

    const reactivations = (leadsToReactivate as any) || [];
    if (reactivations.length > 0) {
      console.log(`Reactivating ${reactivations.length} leads`);
      results.reactivations.processed = reactivations.length;

      for (const leadOffer of reactivations) {
        try {
          await sendReactivation(leadOffer.id);
          results.reactivations.success++;
        } catch (err) {
          console.error(`Error reactivating ${leadOffer.id}:`, err);
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

    results.movedToCooling = ((staleLeads as any) || []).length;

    // ==========================================
    // 5. Credit Alerts (only at 12:00)
    // ==========================================
    const creditAlerts = { sent: 0, errors: 0 };
    const currentHour = now.getUTCHours();
    if (currentHour === 12) {
      // Check tenants with low credits
      const { data: tenants } = await queryWithTimeout(
        supabase
          .from("tenants")
          .select("id, name, credit_balance, min_credits")
          .eq("status", "ACTIVE")
          .lt("credit_balance", supabase.raw("COALESCE(min_credits, 100)")),
        10000,
        "fetch tenants with low credits for daily tasks"
      );

      const lowCreditTenants = (tenants as any) || [];
      if (lowCreditTenants.length > 0) {
        console.log(`Sending credit alerts to ${lowCreditTenants.length} tenants`);
        
        for (const tenant of lowCreditTenants) {
          try {
            // TODO: Send email/notification to tenant about low credits
            // For now, just log it
            console.log(`Tenant ${tenant.name} (${tenant.id}) has low credits: ${tenant.credit_balance}`);
            creditAlerts.sent++;
          } catch (err) {
            console.error(`Error sending credit alert to tenant ${tenant.id}:`, err);
            creditAlerts.errors++;
          }
        }
      }
    }

    console.log("Daily tasks completed:", { ...results, creditAlerts });
    return NextResponse.json({ ...results, creditAlerts });
  } catch (error) {
    console.error("Cron daily-tasks error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        partialResults: results 
      },
      { status: 500 }
    );
  }
}
