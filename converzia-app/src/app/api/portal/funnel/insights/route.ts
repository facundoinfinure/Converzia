import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { MembershipWithRole } from "@/types/supabase-helpers";
import { validateQuery, funnelInsightsQuerySchema } from "@/lib/validation/schemas";

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
      return handleUnauthorized("Debes iniciar sesión para ver insights del funnel");
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
    
    const membership = membershipData as MembershipWithRole | null;
    
    if (!membership) {
      return handleForbidden("No tienes acceso a ningún tenant activo");
    }
    
    const tenantId = membership.tenant_id;
    
    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(searchParams, funnelInsightsQuerySchema);
    
    if (!queryValidation.success) {
      return handleValidationError(new Error(queryValidation.error), {
        validationError: queryValidation.error,
      });
    }
    
    const { offer_id: offerId } = queryValidation.data;
    
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
      return handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudieron obtener los insights",
        context: { tenantId, offerId },
      });
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
    
    return apiSuccess({
      totalDisqualified: disqualifications.length,
      insights,
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al obtener insights",
      context: { operation: "get_funnel_insights" },
    });
  }
}

