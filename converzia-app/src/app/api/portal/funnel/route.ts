import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

/**
 * GET /api/portal/funnel
 * 
 * Returns funnel stats for the authenticated tenant.
 * Query params:
 * - offer_id: Filter by specific offer (optional)
 * - from: Start date filter (optional)
 * - to: End date filter (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    
    // Get user's active tenant membership
    const { data: membershipData } = await queryWithTimeout(
      supabase
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .single(),
      5000,
      "get tenant membership"
    );
    
    const membership = membershipData as { tenant_id: string; role: string } | null;
    
    if (!membership) {
      return NextResponse.json({ error: "No tiene acceso a ningún tenant" }, { status: 403 });
    }
    
    const tenantId = membership.tenant_id;
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get("offer_id");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    
    // Get funnel stats
    if (offerId) {
      // Single offer funnel
      const { data: offerFunnel, error: offerError } = await queryWithTimeout(
        supabase
          .from("offer_funnel_stats")
          .select("*")
          .eq("offer_id", offerId)
          .eq("tenant_id", tenantId)
          .single(),
        10000,
        "get offer funnel stats"
      );
      
      if (offerError) {
        console.error("Error fetching offer funnel:", offerError);
        return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
      }
      
      // Get delivered leads for this offer (with full details)
      const { data: deliveredLeads } = await queryWithTimeout(
        supabase
          .from("tenant_leads_anonymized")
          .select("*")
          .eq("offer_id", offerId)
          .eq("tenant_id", tenantId)
          .eq("status", "SENT_TO_DEVELOPER")
          .order("qualified_at", { ascending: false })
          .limit(50),
        10000,
        "get delivered leads"
      );
      
      return NextResponse.json({
        success: true,
        data: {
          funnel: offerFunnel,
          deliveredLeads: deliveredLeads || [],
        }
      });
    } else {
      // Aggregated tenant funnel
      const { data: tenantFunnel, error: tenantError } = await queryWithTimeout(
        supabase
          .from("tenant_funnel_stats")
          .select("*")
          .eq("tenant_id", tenantId)
          .single(),
        10000,
        "get tenant funnel stats"
      );
      
      if (tenantError) {
        console.error("Error fetching tenant funnel:", tenantError);
        return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
      }
      
      // Get per-offer breakdown
      const { data: offerBreakdown } = await queryWithTimeout(
        supabase
          .from("offer_funnel_stats")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("total_leads", { ascending: false }),
        10000,
        "get offer breakdown"
      );
      
      return NextResponse.json({
        success: true,
        data: {
          funnel: tenantFunnel,
          offers: offerBreakdown || [],
        }
      });
    }
  } catch (error) {
    console.error("Funnel API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

