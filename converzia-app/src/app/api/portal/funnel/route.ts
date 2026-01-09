import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { isAdminProfile, type MembershipWithRole } from "@/types/supabase-helpers";
import { validateQuery, funnelQuerySchema } from "@/lib/validation/schemas";
import { getTenantFunnelStats, getOfferFunnelStats, getTenantOfferStats } from "@/lib/services/stats";

/**
 * GET /api/portal/funnel
 * 
 * Returns funnel stats for the authenticated tenant using the centralized stats service.
 * Query params:
 * - offer_id: Filter by specific offer (optional)
 * - from: Start date filter (optional) - Note: date filtering not yet implemented in stats service
 * - to: End date filter (optional) - Note: date filtering not yet implemented in stats service
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
    
    const { offer_id: offerId } = queryValidation.data;
    
    // Get funnel stats using centralized service
    if (offerId) {
      // Single offer funnel
      const offerStats = await getOfferFunnelStats(offerId);
      
      if (!offerStats) {
        return handleApiError(new Error("Offer not found"), {
          code: ErrorCode.NOT_FOUND,
          status: 404,
          message: "No se encontró el proyecto",
          context: { offerId, tenantId },
        });
      }
      
      // Verify offer belongs to this tenant
      if (offerStats.tenantId !== tenantId) {
        return handleForbidden("No tienes acceso a este proyecto");
      }
      
      // Convert to legacy format for backward compatibility
      const funnel = {
        offer_id: offerStats.offerId,
        tenant_id: offerStats.tenantId,
        offer_name: offerStats.offerName,
        offer_status: offerStats.offerStatus,
        approval_status: offerStats.approvalStatus,
        total_leads: offerStats.totalLeads,
        leads_pending_mapping: offerStats.pipelineStats.pendingMapping,
        leads_pending_contact: offerStats.pipelineStats.toBeContacted,
        leads_received: offerStats.received,
        leads_in_chat: offerStats.inChat,
        leads_qualified: offerStats.qualified,
        leads_delivered: offerStats.delivered,
        leads_disqualified: offerStats.pipelineStats.disqualified,
        leads_stopped: offerStats.pipelineStats.stopped + offerStats.pipelineStats.cooling + offerStats.pipelineStats.reactivation,
        leads_not_qualified: offerStats.notQualified,
        conversion_rate: offerStats.conversionRate,
        first_lead_at: offerStats.firstLeadAt,
        last_lead_at: offerStats.lastLeadAt,
      };
      
      // Get delivered leads for this offer (need admin client for RLS bypass)
      const adminClient = createAdminClient();
      const { data: deliveredLeads } = await queryWithTimeout(
        adminClient
          .from("lead_offers")
          .select(`
            id,
            status,
            qualified_at,
            created_at,
            lead:leads(id, phone, full_name, email)
          `)
          .eq("offer_id", offerId)
          .eq("tenant_id", tenantId)
          .eq("status", "SENT_TO_DEVELOPER")
          .order("qualified_at", { ascending: false })
          .limit(50),
        10000,
        "get delivered leads"
      );
      
      return apiSuccess({
        funnel,
        deliveredLeads: deliveredLeads || [],
      });
    } else {
      // Get tenant stats from centralized service
      const tenantStats = await getTenantFunnelStats(tenantId);
      
      if (!tenantStats) {
        return handleApiError(new Error("Tenant not found"), {
          code: ErrorCode.NOT_FOUND,
          status: 404,
          message: "No se encontró el tenant",
          context: { tenantId },
        });
      }
      
      // Convert to legacy format for backward compatibility
      const funnel = {
        tenant_id: tenantStats.tenantId,
        tenant_name: tenantStats.tenantName,
        total_leads: tenantStats.totalLeads,
        leads_pending_mapping: tenantStats.pipelineStats.pendingMapping,
        leads_pending_contact: tenantStats.pipelineStats.toBeContacted,
        leads_received: tenantStats.received,
        leads_in_chat: tenantStats.inChat,
        leads_qualified: tenantStats.qualified,
        leads_delivered: tenantStats.delivered,
        leads_disqualified: tenantStats.pipelineStats.disqualified,
        leads_stopped: tenantStats.pipelineStats.stopped + tenantStats.pipelineStats.cooling + tenantStats.pipelineStats.reactivation,
        leads_not_qualified: tenantStats.notQualified,
        conversion_rate: tenantStats.conversionRate,
        credit_balance: tenantStats.creditBalance,
        active_offers_count: tenantStats.activeOffers,
      };
      
      // Get per-offer breakdown
      const offerStats = await getTenantOfferStats(tenantId);
      
      // Convert offer stats to legacy format
      const offers = offerStats.map(os => ({
        offer_id: os.offerId,
        tenant_id: os.tenantId,
        offer_name: os.offerName,
        offer_status: os.offerStatus,
        approval_status: os.approvalStatus,
        total_leads: os.totalLeads,
        leads_received: os.received,
        leads_in_chat: os.inChat,
        leads_qualified: os.qualified,
        leads_delivered: os.delivered,
        leads_not_qualified: os.notQualified,
        conversion_rate: os.conversionRate,
      }));
      
      logger.info("[API Funnel] Funnel stats retrieved", { tenantId, totalLeads: tenantStats.totalLeads });
      
      return apiSuccess({
        funnel,
        offers,
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
