import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { isAdminProfile, type MembershipWithRole } from "@/types/supabase-helpers";
import { validateQuery, funnelQuerySchema } from "@/lib/validation/schemas";

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
      return handleUnauthorized("Debes iniciar sesión para ver estadísticas del funnel");
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

    // Check if user is a Converzia admin
    const { data: profile } = await queryWithTimeout<{ is_converzia_admin?: boolean } | null>(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      5000,
      "get user profile"
    );
    const isAdmin = isAdminProfile(profile);
    
    if (!membership && !isAdmin) {
      return handleForbidden("No tienes acceso a ningún tenant activo");
    }
    
    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(searchParams, funnelQuerySchema);
    
    // For admins without membership, they need to provide tenant_id in query
    const tenantId = membership?.tenant_id || searchParams.get("tenant_id");
    if (!tenantId) {
      return handleForbidden("Se requiere tenant_id");
    }
    
    if (!queryValidation.success) {
      return handleValidationError(new Error(queryValidation.error), {
        validationError: queryValidation.error,
      });
    }
    
    const { offer_id: offerId, from: fromDate, to: toDate } = queryValidation.data;
    
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
        return handleApiError(offerError, {
          code: ErrorCode.DATABASE_ERROR,
          status: 500,
          message: "No se pudieron obtener las estadísticas del funnel",
          context: { offerId, tenantId },
        });
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
      
      return apiSuccess({
        funnel: offerFunnel,
        deliveredLeads: deliveredLeads || [],
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
        return handleApiError(tenantError, {
          code: ErrorCode.DATABASE_ERROR,
          status: 500,
          message: "No se pudieron obtener las estadísticas del funnel",
          context: { tenantId },
        });
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
      
      return apiSuccess({
        funnel: tenantFunnel,
        offers: offerBreakdown || [],
      });
    }
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al obtener estadísticas del funnel",
      context: { operation: "get_funnel_stats" },
    });
  }
}

