import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// ============================================
// Cron Job: Credit Alerts
// Runs daily at 9am to notify tenants with low credits
// ============================================

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Get tenants with low credits
    const { data: lowCreditTenants, error } = await supabase
      .from("tenant_credit_balance")
      .select(`
        tenant_id,
        current_balance,
        tenants:tenant_id (
          name,
          contact_email
        )
      `)
      .lt("current_balance", 10);

    if (error) {
      console.error("Error fetching low credit tenants:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!lowCreditTenants || lowCreditTenants.length === 0) {
      return NextResponse.json({ alerted: 0, message: "No tenants with low credits" });
    }

    console.log(`Found ${lowCreditTenants.length} tenants with low credits`);

    // In production, send emails to tenant admins
    // For now, just log and track in events
    let alertCount = 0;

    for (const tenant of lowCreditTenants) {
      const tenantInfo = tenant.tenants as any;

      // Log event
      await supabase.from("lead_events").insert({
        tenant_id: tenant.tenant_id,
        event_type: "MANUAL_ACTION",
        details: {
          current_balance: tenant.current_balance,
          tenant_name: tenantInfo?.name,
          action: "CREDIT_ALERT",
          alert_type: tenant.current_balance === 0 ? "ZERO_CREDITS" : "LOW_CREDITS",
        },
        actor_type: "SYSTEM",
      });

      // TODO: Send email notification
      // await sendLowCreditEmail(tenantInfo.contact_email, {
      //   tenant_name: tenantInfo.name,
      //   current_balance: tenant.current_balance,
      // });

      alertCount++;
    }

    return NextResponse.json({
      alerted: alertCount,
      details: lowCreditTenants.map((t: { tenant_id: string; current_balance: number }) => ({
        tenant_id: t.tenant_id,
        balance: t.current_balance,
      })),
    });
  } catch (error) {
    console.error("Cron credit-alerts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

