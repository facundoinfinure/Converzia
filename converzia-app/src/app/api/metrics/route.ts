import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { getCurrentMetrics } from "@/lib/monitoring";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

// ============================================
// Metrics API
// Returns current system metrics
// ============================================

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.api);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin access
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile for metrics"
    );

    if (!(profile as any)?.is_converzia_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get in-memory metrics
    const metrics = getCurrentMetrics();

    // Get database metrics
    const adminSupabase = createAdminClient();
    
    // Get delivery stats
    const { count: totalDeliveries } = await queryWithTimeout(
      adminSupabase
        .from("deliveries")
        .select("id", { count: "exact", head: true }),
      10000,
      "get delivery count"
    );

    const { count: pendingDeliveries } = await queryWithTimeout(
      adminSupabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
      10000,
      "get pending deliveries count"
    );

    const { count: deliveredCount } = await queryWithTimeout(
      adminSupabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "DELIVERED"),
      10000,
      "get delivered count"
    );

    // Get lead stats
    const { count: totalLeads } = await queryWithTimeout(
      adminSupabase
        .from("leads")
        .select("id", { count: "exact", head: true }),
      10000,
      "get leads count"
    );

    // Get tenant stats
    const { count: activeTenants } = await queryWithTimeout(
      adminSupabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE"),
      10000,
      "get active tenants count"
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      in_memory: metrics,
      database: {
        deliveries: {
          total: totalDeliveries || 0,
          pending: pendingDeliveries || 0,
          delivered: deliveredCount || 0,
          success_rate: totalDeliveries 
            ? ((deliveredCount || 0) / totalDeliveries * 100).toFixed(2) + "%"
            : "0%",
        },
        leads: {
          total: totalLeads || 0,
        },
        tenants: {
          active: activeTenants || 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

