import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

/**
 * GET /api/portal/funnel/insights
 * 
 * Returns disqualification insights for funnel analysis.
 * Query params:
 * - offer_id: Filter by specific offer (optional)
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
    
    // Build query for disqualification breakdown
    let query = supabase
      .from("lead_offers")
      .select("disqualification_category, disqualification_reason")
      .eq("tenant_id", tenantId)
      .eq("status", "DISQUALIFIED")
      .not("disqualification_category", "is", null);
    
    if (offerId) {
      query = query.eq("offer_id", offerId);
    }
    
    const { data: disqualificationsData, error } = await queryWithTimeout(
      query,
      10000,
      "get disqualification insights"
    );
    
    if (error) {
      console.error("Error fetching insights:", error);
      return NextResponse.json({ error: "Error al obtener insights" }, { status: 500 });
    }
    
    const disqualifications = Array.isArray(disqualificationsData) 
      ? disqualificationsData as Array<{ disqualification_category: string; disqualification_reason: string | null }>
      : [];
    
    // Aggregate by category
    const categoryLabels: Record<string, string> = {
      PRICE_TOO_HIGH: "Precio fuera de rango (alto)",
      PRICE_TOO_LOW: "Precio fuera de rango (bajo)",
      WRONG_ZONE: "Zona no compatible",
      WRONG_TYPOLOGY: "Tipología no disponible",
      NO_RESPONSE: "Sin respuesta",
      NOT_INTERESTED: "No interesado",
      MISSING_AMENITY: "Amenity no disponible",
      DUPLICATE: "Lead duplicado",
      OTHER: "Otros motivos",
    };
    
    const categoryCounts: Record<string, { count: number; label: string; reasons: string[] }> = {};
    
    for (const dq of disqualifications) {
      const cat = dq.disqualification_category;
      if (!categoryCounts[cat]) {
        categoryCounts[cat] = {
          count: 0,
          label: categoryLabels[cat] || cat,
          reasons: [],
        };
      }
      categoryCounts[cat].count++;
      if (dq.disqualification_reason && !categoryCounts[cat].reasons.includes(dq.disqualification_reason)) {
        categoryCounts[cat].reasons.push(dq.disqualification_reason);
      }
    }
    
    // Convert to sorted array
    const insights = Object.entries(categoryCounts)
      .map(([category, data]) => ({
        category,
        label: data.label,
        count: data.count,
        percentage: disqualifications.length 
          ? Math.round((data.count / disqualifications.length) * 100) 
          : 0,
        sampleReasons: data.reasons.slice(0, 3), // Top 3 specific reasons
      }))
      .sort((a, b) => b.count - a.count);
    
    return NextResponse.json({
      success: true,
      data: {
        totalDisqualified: disqualifications.length,
        insights,
      }
    });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

