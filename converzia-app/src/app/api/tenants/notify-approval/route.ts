import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTenantApprovalEmail } from "@/lib/services/email";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

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
    const body = await request.json();
    const { tenant_id, tenant_name, emails } = body;

    if (!tenant_id || !tenant_name || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Send emails
    const results = await Promise.allSettled(
      emails.map((email: string) => sendTenantApprovalEmail(email, tenant_name))
    );

    const successCount = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const errors = results
      .filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success))
      .map((r) => r.status === "rejected" ? r.reason : (r as any).value.error);

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
      console.error("Error creating notification event:", eventError);
    }

    return NextResponse.json({
      success: true,
      emails_sent: successCount,
      total: emails.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

