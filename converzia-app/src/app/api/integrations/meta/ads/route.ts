import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCampaignStructure,
  getAdAccounts,
  MetaOAuthTokens,
} from "@/lib/services/meta-ads";

// GET /api/integrations/meta/ads - List ads from connected Meta account
// The Meta connection is global (Admin's account), not per-tenant
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
    const accountId = searchParams.get("account_id");

    // Look for a global Meta Ads integration (any active one - Admin's connection)
    // First try to find one without tenant_id (global), then fall back to any active one
    let integration;
    
    const { data: globalIntegration } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("integration_type", "META_ADS")
      .eq("is_active", true)
      .is("tenant_id", null)
      .maybeSingle();

    if (globalIntegration) {
      integration = globalIntegration;
    } else {
      // Fall back to any active META_ADS integration (legacy per-tenant setup)
      const { data: anyIntegration, error: integrationError } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("integration_type", "META_ADS")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (integrationError) {
        console.error("Error fetching Meta integration:", integrationError);
        return NextResponse.json(
          { error: "Failed to fetch integration" },
          { status: 500 }
        );
      }
      integration = anyIntegration;
    }

    if (!integration) {
      return NextResponse.json(
        { error: "Meta Ads no conectado. Conectá tu cuenta de Meta desde Configuración.", not_connected: true },
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

    const config = integration.config as any;
    const selectedAccountId = config?.selected_ad_account_id;

    // If no account_id specified, return info about selected account or list of accounts
    if (!accountId) {
      const adAccounts = config?.ad_accounts || [];
      
      // If no cached accounts, fetch from API
      if (adAccounts.length === 0) {
        const accounts = await getAdAccounts(tokens.access_token);
        return NextResponse.json({ 
          ad_accounts: accounts,
          selected_ad_account_id: selectedAccountId,
        });
      }

      return NextResponse.json({ 
        ad_accounts: adAccounts,
        selected_ad_account_id: selectedAccountId,
      });
    }

    // Use the provided accountId or the selected one
    const targetAccountId = accountId;

    // Fetch campaign structure for specified account
    const { campaigns, adsets, ads } = await getCampaignStructure(
      targetAccountId,
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
      account_id: targetAccountId,
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

