import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdInsights, MetaOAuthTokens } from "@/lib/services/meta-ads";

// POST /api/integrations/meta/costs - Sync costs from Meta Ads
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { tenant_id, account_id, date_start, date_end } = body;

    if (!tenant_id || !account_id) {
      return NextResponse.json(
        { error: "tenant_id and account_id are required" },
        { status: 400 }
      );
    }

    // Default to last 30 days if no dates provided
    const endDate = date_end || new Date().toISOString().split("T")[0];
    const startDate =
      date_start ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get Meta integration for this tenant
    const { data: integration, error: integrationError } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("integration_type", "META_ADS")
      .eq("is_active", true)
      .maybeSingle();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: "Meta Ads not connected for this tenant" },
        { status: 404 }
      );
    }

    const tokens = integration.oauth_tokens as MetaOAuthTokens;

    if (!tokens?.access_token) {
      return NextResponse.json(
        { error: "No access token found" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (tokens.expires_at && Date.now() > tokens.expires_at) {
      return NextResponse.json(
        { error: "Access token expired. Please reconnect Meta." },
        { status: 401 }
      );
    }

    // Fetch insights from Meta
    const insights = await getAdInsights(
      account_id,
      tokens.access_token,
      startDate,
      endDate
    );

    if (insights.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No data found for the specified date range",
        synced: 0,
      });
    }

    // Get ad mappings to link costs to offers
    const { data: adMappings } = await supabase
      .from("ad_offer_map")
      .select("ad_id, offer_id")
      .eq("tenant_id", tenant_id);

    const adToOfferMap = new Map(
      (adMappings || []).map((m) => [m.ad_id, m.offer_id])
    );

    // Prepare cost records
    const costRecords = insights.map((insight) => {
      // Extract lead count from actions
      const leadAction = insight.actions?.find(
        (a) =>
          a.action_type === "lead" ||
          a.action_type === "leadgen_grouped" ||
          a.action_type === "onsite_conversion.lead_grouped"
      );
      const leadsRaw = leadAction ? parseInt(leadAction.value) || 0 : 0;

      return {
        tenant_id,
        offer_id: adToOfferMap.get(insight.ad_id) || null,
        platform: "META" as const,
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        adset_id: insight.adset_id,
        adset_name: insight.adset_name,
        ad_id: insight.ad_id,
        ad_name: insight.ad_name,
        spend: insight.spend,
        impressions: insight.impressions,
        clicks: insight.clicks,
        leads_raw: leadsRaw,
        date_start: insight.date_start,
        date_end: insight.date_stop,
        synced_at: new Date().toISOString(),
        platform_data: {
          actions: insight.actions,
        },
      };
    });

    // Upsert cost records
    const { error: upsertError } = await supabase
      .from("platform_costs")
      .upsert(costRecords, {
        onConflict: "tenant_id,platform,ad_id,date_start,date_end",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Error upserting platform costs:", upsertError);
      return NextResponse.json(
        { error: "Failed to save cost data" },
        { status: 500 }
      );
    }

    // Calculate totals
    const totalSpend = insights.reduce((sum, i) => sum + i.spend, 0);
    const totalImpressions = insights.reduce((sum, i) => sum + i.impressions, 0);
    const totalClicks = insights.reduce((sum, i) => sum + i.clicks, 0);

    return NextResponse.json({
      success: true,
      synced: costRecords.length,
      date_range: { start: startDate, end: endDate },
      totals: {
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
      },
    });
  } catch (error: any) {
    console.error("Error syncing Meta costs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync costs" },
      { status: 500 }
    );
  }
}

// GET /api/integrations/meta/costs - Get synced costs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const offerId = searchParams.get("offer_id");

    let query = supabase
      .from("platform_costs")
      .select("*")
      .eq("platform", "META")
      .order("date_start", { ascending: false });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    if (offerId) {
      query = query.eq("offer_id", offerId);
    }

    const { data: costs, error } = await query;

    if (error) {
      console.error("Error fetching costs:", error);
      return NextResponse.json(
        { error: "Failed to fetch costs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ costs });
  } catch (error) {
    console.error("Error in GET costs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

