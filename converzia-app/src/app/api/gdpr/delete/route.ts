import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    if (!(profile as any)?.is_converzia_admin) {
      return NextResponse.json(
        { error: "Admin access required for data deletion" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { lead_id, reason } = body;

    if (!lead_id) {
      return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required for audit trail" },
        { status: 400 }
      );
    }

    // Call the GDPR deletion function
    const { data, error } = await queryWithTimeout(
      (admin as any).rpc("delete_lead_pii", {
        p_lead_id: lead_id,
        p_reason: reason,
        p_deleted_by: user.id,
      }),
      30000, // Longer timeout for deletion
      "execute GDPR lead deletion"
    );

    if (error) {
      console.error("GDPR deletion error:", error);
      return NextResponse.json(
        { error: "Failed to delete lead data" },
        { status: 500 }
      );
    }

    // Log the deletion for audit
    console.log("GDPR: Lead PII deleted", {
      lead_id,
      reason,
      deleted_by: user.id,
      deleted_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Lead PII data has been deleted",
      lead_id,
    });
  } catch (error) {
    console.error("GDPR delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check deletion status
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lead_id = searchParams.get("lead_id");

  if (!lead_id) {
    return NextResponse.json(
      { error: "lead_id query parameter required" },
      { status: 400 }
    );
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
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Check if lead data was anonymized
  const isDeleted = (lead as any).phone?.startsWith("DELETED_") || 
                    (lead as any).full_name === "[ELIMINADO]";

  return NextResponse.json({
    lead_id,
    pii_deleted: isDeleted,
    opted_out: (lead as any).opted_out,
    opted_out_at: (lead as any).opted_out_at,
    reason: (lead as any).opt_out_reason,
  });
}

