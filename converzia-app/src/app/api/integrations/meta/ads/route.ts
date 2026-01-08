import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import {
  getCampaignStructure,
  getAdAccounts,
  MetaOAuthTokens,
} from "@/lib/services/meta-ads";
import { validateQuery, metaAdsQuerySchema } from "@/lib/validation/schemas";
import { handleApiError, handleUnauthorized, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";
import type { MetaIntegrationConfig } from "@/types/supabase-helpers";

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
      return handleUnauthorized("Debes iniciar sesión para ver los anuncios");
    }

    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(searchParams, metaAdsQuerySchema);
    
    if (!queryValidation.success) {
      return handleValidationError(new Error(queryValidation.error), {
        validationError: queryValidation.error,
      });
    }
    
    const accountId = queryValidation.data.account_id || null;

    // Look for a global Meta Ads integration (any active one - Admin's connection)
    // First try to find one without tenant_id (global), then fall back to any active one
    let integration;
    
    type TenantIntegrationRow = {
      id: string;
      tenant_id: string | null;
      integration_type: string;
      is_active: boolean;
      oauth_tokens: unknown;
      config: unknown;
    };

    const { data: globalIntegration } = await queryWithTimeout<TenantIntegrationRow | null>(
      supabase
        .from("tenant_integrations")
        .select("*")
        .eq("integration_type", "META_ADS")
        .eq("is_active", true)
        .is("tenant_id", null)
        .maybeSingle(),
      5000,
      "get global meta integration"
    );

    if (globalIntegration) {
      integration = globalIntegration;
    } else {
      // Fall back to any active META_ADS integration (legacy per-tenant setup)
      const { data: anyIntegration, error: integrationError } = await queryWithTimeout<TenantIntegrationRow | null>(
        supabase
          .from("tenant_integrations")
          .select("*")
          .eq("integration_type", "META_ADS")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
        5000,
        "get meta integration fallback"
      );

      if (integrationError) {
        return handleApiError(integrationError, {
          code: ErrorCode.DATABASE_ERROR,
          status: 500,
          message: "No se pudo obtener la integración",
          context: { operation: "get_meta_ads" },
        });
      }
      integration = anyIntegration;
    }

    if (!integration) {
      return handleApiError(new Error("Meta Ads not connected"), {
        code: ErrorCode.NOT_FOUND,
        status: 404,
        message: "Meta Ads no conectado. Conectá tu cuenta de Meta desde Configuración.",
        context: { not_connected: true },
      });
    }

    const tokens = integration.oauth_tokens as MetaOAuthTokens;

    if (!tokens?.access_token) {
      return handleValidationError(new Error("No access token"), {
        issue: "missing_token",
      });
    }

    // Check if token is expired
    if (tokens.expires_at && Date.now() > tokens.expires_at) {
      return handleUnauthorized("El token de acceso expiró. Por favor reconectá Meta.");
    }

    const config = integration.config as MetaIntegrationConfig | null;
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
    logger.info("Fetching campaigns for account", { accountId: targetAccountId });
    const { campaigns, adsets, ads } = await getCampaignStructure(
      targetAccountId,
      tokens.access_token
    );
    logger.info("Results", { 
      accountId: targetAccountId,
      campaigns: campaigns.length, 
      adsets: adsets.length, 
      ads: ads.length 
    });

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
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al obtener anuncios de Meta",
      context: { operation: "get_meta_ads" },
    });
  }
}

