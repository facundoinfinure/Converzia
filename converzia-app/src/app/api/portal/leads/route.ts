import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { handleApiError, handleUnauthorized, handleForbidden, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";

// ============================================
// Portal Leads API
// Uses admin client to bypass RLS restrictions on lead_offers
// RLS only allows seeing SENT_TO_DEVELOPER status, but tenants need
// to see their funnel stages (which stats views show via SECURITY DEFINER)
// ============================================

interface LeadOfferRow {
  id: string;
  status: string;
  score_total: number | null;
  qualification_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  offer_id: string;
}

export async function GET(request: NextRequest) {
  try {
    // Auth check with regular client
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");
    const statuses = searchParams.get("statuses")?.split(",") || [];
    const offerFilter = searchParams.get("offer_id");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id requerido" }, { status: 400 });
    }

    if (statuses.length === 0) {
      return NextResponse.json({ error: "statuses requerido" }, { status: 400 });
    }

    // Verify user has access to this tenant
    const { data: membership } = await queryWithTimeout(
      supabase
        .from("tenant_members")
        .select("role, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .single(),
      5000,
      "check membership"
    );

    if (!membership) {
      return handleForbidden("No tienes acceso a este tenant");
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient();

    // Get tenant's offer IDs
    let offerIds: string[] = [];
    
    if (offerFilter) {
      // Verify the offer belongs to this tenant
      const { data: offer } = await queryWithTimeout(
        adminSupabase
          .from("offers")
          .select("id")
          .eq("id", offerFilter)
          .eq("tenant_id", tenantId)
          .single(),
        5000,
        "verify offer"
      );
      
      if (offer) {
        offerIds = [offerFilter];
      }
    } else {
      // Get all tenant's offers
      const { data: offers } = await queryWithTimeout(
        adminSupabase
          .from("offers")
          .select("id")
          .eq("tenant_id", tenantId),
        5000,
        "get tenant offers"
      );
      
      if (offers && Array.isArray(offers)) {
        offerIds = offers.map((o: { id: string }) => o.id);
      }
    }

    if (offerIds.length === 0) {
      return apiSuccess({ leads: [], offerNames: {} });
    }

    // Query lead_offers with admin client (bypasses RLS)
    const { data: leads, error: leadsError } = await queryWithTimeout(
      adminSupabase
        .from("lead_offers")
        .select(`
          id,
          status,
          score_total,
          qualification_fields,
          created_at,
          updated_at,
          offer_id
        `)
        .in("offer_id", offerIds)
        .in("status", statuses)
        .order("updated_at", { ascending: false })
        .limit(limit),
      10000,
      "get leads"
    );

    if (leadsError) {
      logger.error("Error fetching leads", leadsError);
      return handleApiError(leadsError, {
        code: ErrorCode.DATABASE_ERROR,
        message: "Error al cargar leads",
      });
    }

    const leadsData = (leads || []) as LeadOfferRow[];

    // Get offer names
    const uniqueOfferIds = [...new Set(leadsData.map(l => l.offer_id).filter(Boolean))];
    let offerNames: Record<string, string> = {};
    
    if (uniqueOfferIds.length > 0) {
      const { data: offersData } = await queryWithTimeout(
        adminSupabase
          .from("offers")
          .select("id, name")
          .in("id", uniqueOfferIds),
        5000,
        "get offer names"
      );
      
      if (offersData) {
        offerNames = Object.fromEntries(
          (offersData as { id: string; name: string }[]).map(o => [o.id, o.name])
        );
      }
    }

    return apiSuccess({ 
      leads: leadsData,
      offerNames 
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      message: "Error al cargar leads",
    });
  }
}
