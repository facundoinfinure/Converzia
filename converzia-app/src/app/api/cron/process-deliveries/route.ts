import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { processDelivery } from "@/lib/services/delivery";
import { withCronAuth } from "@/lib/security/cron-auth";

// ============================================
// Cron Job: Process Pending Deliveries
// Runs every 5 minutes via Vercel Cron
// ============================================

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max

export async function GET(request: NextRequest) {
  // SECURITY: Validate cron secret - REQUIRED
  const authError = withCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    // Get pending deliveries
    const { data: pendingDeliveries, error } = await queryWithTimeout(
      supabase
        .from("deliveries")
        .select("id, tenant_id, lead_id, retry_count")
        .eq("status", "PENDING")
        .lt("retry_count", 3) // Max 3 retries
        .order("created_at", { ascending: true })
        .limit(20), // Process in batches
      10000,
      "fetch pending deliveries"
    );

    if (error) {
      console.error("Error fetching pending deliveries:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const deliveries = (pendingDeliveries as any) || [];
    if (deliveries.length === 0) {
      return NextResponse.json({ processed: 0, message: "No pending deliveries" });
    }

    console.log(`Processing ${deliveries.length} pending deliveries`);

    let successCount = 0;
    let errorCount = 0;

    // Process each delivery
    for (const delivery of deliveries) {
      try {
        await processDelivery(delivery.id);
        successCount++;
      } catch (err) {
        console.error(`Error processing delivery ${delivery.id}:`, err);
        errorCount++;

        // Increment retry count
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

    return NextResponse.json({
      processed: deliveries.length,
      success: successCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error("Cron process-deliveries error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

