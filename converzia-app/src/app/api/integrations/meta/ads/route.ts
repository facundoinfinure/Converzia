import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCampaignStructure,
  getAdAccounts,
  MetaOAuthTokens,
} from "@/lib/services/meta-ads";

// GET /api/integrations/meta/ads - List ads from connected Meta account
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

    // Get tenant_id from query params
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const accountId = searchParams.get("account_id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }

    // Get Meta integration for this tenant
    const { data: integration, error: integrationError } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "META_ADS")
      .eq("is_active", true)
      .maybeSingle();

    if (integrationError) {
      console.error("Error fetching Meta integration:", integrationError);
      return NextResponse.json(
        { error: "Failed to fetch integration" },
        { status: 500 }
      );
    }

    if (!integration) {
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

    // If no account_id specified, return list of ad accounts
    if (!accountId) {
      const adAccounts = (integration.config as any)?.ad_accounts || [];
      
      // If no cached accounts, fetch from API
      if (adAccounts.length === 0) {
        const accounts = await getAdAccounts(tokens.access_token);
        return NextResponse.json({ ad_accounts: accounts });
      }

      return NextResponse.json({ ad_accounts: adAccounts });
    }

    // Fetch campaign structure for specified account
    const { campaigns, adsets, ads } = await getCampaignStructure(
      accountId,
      tokens.access_token
    );

    // Organize into hierarchical structure
    const campaignMap = new Map<string, {
      campaign: typeof campaigns[0];
      adsets: Map<string, {
        adset: typeof adsets[0];
        ads: typeof ads;
      }>;
    }>();

    // Group by campaign
    campaigns.forEach((campaign) => {
      campaignMap.set(campaign.id, {
        campaign,
        adsets: new Map(),
      });
    });

    // Group adsets by campaign
    adsets.forEach((adset) => {
      const campaignData = campaignMap.get(adset.campaign_id);
      if (campaignData) {
        campaignData.adsets.set(adset.id, {
          adset,
          ads: [],
        });
      }
    });

    // Group ads by adset
    ads.forEach((ad) => {
      const campaignData = campaignMap.get(ad.campaign_id);
      if (campaignData) {
        const adsetData = campaignData.adsets.get(ad.adset_id);
        if (adsetData) {
          adsetData.ads.push(ad);
        }
      }
    });

    // Convert to array structure
    const structure = Array.from(campaignMap.values()).map(({ campaign, adsets: adsetMap }) => ({
      ...campaign,
      adsets: Array.from(adsetMap.values()).map(({ adset, ads }) => ({
        ...adset,
        ads,
      })),
    }));

    return NextResponse.json({
      account_id: accountId,
      campaigns: structure,
      totals: {
        campaigns: campaigns.length,
        adsets: adsets.length,
        ads: ads.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching Meta ads:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch ads" },
      { status: 500 }
    );
  }
}

