import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { processDelivery } from "@/lib/services/delivery";
import { retryContact, sendReactivation } from "@/lib/services/conversation";

// ============================================
// Cron Job: Daily Tasks (Combined)
// Runs daily - processes deliveries, retries, and reactivations
// ============================================

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    if (pendingDeliveries && pendingDeliveries.length > 0) {
      console.log(`Processing ${pendingDeliveries.length} pending deliveries`);
      results.deliveries.processed = pendingDeliveries.length;

      for (const delivery of pendingDeliveries) {
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

    if (contactsToRetry && contactsToRetry.length > 0) {
      console.log(`Retrying ${contactsToRetry.length} contacts`);
      results.retries.processed = contactsToRetry.length;

      for (const leadOffer of contactsToRetry) {
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

    if (leadsToReactivate && leadsToReactivate.length > 0) {
      console.log(`Reactivating ${leadsToReactivate.length} leads`);
      results.reactivations.processed = leadsToReactivate.length;

      for (const leadOffer of leadsToReactivate) {
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

    results.movedToCooling = staleLeads?.length || 0;

    console.log("Daily tasks completed:", results);
    return NextResponse.json(results);
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
