/**
 * Meta Ads API Service
 * Handles interactions with Meta (Facebook) Marketing API
 */

import { logger } from "@/lib/utils/logger";

const META_API_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ============================================
// Types
// ============================================

export interface MetaAdAccount {
  id: string;
  account_id: string;
  name: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  created_time: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  targeting?: Record<string, unknown>;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id: string;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
  };
  created_time: string;
}

export interface MetaAdInsights {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export interface MetaOAuthTokens {
  access_token: string;
  token_type: string;
  expires_at: number;
  scope?: string;
}

interface MetaApiResponse<T> {
  data?: T[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// ============================================
// Helper Functions
// ============================================

async function metaApiRequest<T>(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<MetaApiResponse<T>> {
  const url = new URL(`${META_API_BASE}${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const { fetchWithTimeout } = await import("@/lib/utils/fetch-with-timeout");
  const response = await fetchWithTimeout(url.toString(), {}, 30000);
  const data = await response.json();

  if (data.error) {
    logger.error("Meta API Error", data.error, { url: url.toString() });
    throw new Error(data.error.message || "Meta API request failed");
  }

  return data;
}

// ============================================
// Ad Account Functions
// ============================================

/**
 * Get all ad accounts for the authenticated user
 */
export async function getAdAccounts(
  accessToken: string
): Promise<MetaAdAccount[]> {
  const response = await metaApiRequest<MetaAdAccount>(
    "/me/adaccounts",
    accessToken,
    { fields: "id,account_id,name" }
  );

  return response.data || [];
}

// ============================================
// Campaign Functions
// ============================================

/**
 * Get all campaigns for an ad account
 */
export async function getCampaigns(
  accountId: string,
  accessToken: string
): Promise<MetaCampaign[]> {
  // Ensure account ID has the "act_" prefix
  const formattedAccountId = accountId.startsWith("act_")
    ? accountId
    : `act_${accountId}`;

  const response = await metaApiRequest<MetaCampaign>(
    `/${formattedAccountId}/campaigns`,
    accessToken,
    {
      fields: "id,name,status,objective,created_time",
      limit: "100",
    }
  );

  return response.data || [];
}

// ============================================
// Ad Set Functions
// ============================================

/**
 * Get all ad sets for a campaign
 */
export async function getAdSets(
  campaignId: string,
  accessToken: string
): Promise<MetaAdSet[]> {
  const response = await metaApiRequest<MetaAdSet>(
    `/${campaignId}/adsets`,
    accessToken,
    {
      fields: "id,name,status,campaign_id",
      limit: "100",
    }
  );

  return response.data || [];
}

/**
 * Get all ad sets for an ad account
 */
export async function getAccountAdSets(
  accountId: string,
  accessToken: string
): Promise<MetaAdSet[]> {
  const formattedAccountId = accountId.startsWith("act_")
    ? accountId
    : `act_${accountId}`;

  const response = await metaApiRequest<MetaAdSet>(
    `/${formattedAccountId}/adsets`,
    accessToken,
    {
      fields: "id,name,status,campaign_id",
      limit: "100",
    }
  );

  return response.data || [];
}

// ============================================
// Ad Functions
// ============================================

/**
 * Get all ads for an ad set
 */
export async function getAds(
  adsetId: string,
  accessToken: string
): Promise<MetaAd[]> {
  const response = await metaApiRequest<MetaAd>(
    `/${adsetId}/ads`,
    accessToken,
    {
      fields: "id,name,status,adset_id,campaign_id,creative{id,name,thumbnail_url},created_time",
      limit: "100",
    }
  );

  return response.data || [];
}

/**
 * Get all ads for an ad account
 */
export async function getAccountAds(
  accountId: string,
  accessToken: string
): Promise<MetaAd[]> {
  const formattedAccountId = accountId.startsWith("act_")
    ? accountId
    : `act_${accountId}`;

  const response = await metaApiRequest<MetaAd>(
    `/${formattedAccountId}/ads`,
    accessToken,
    {
      fields: "id,name,status,adset_id,campaign_id,creative{id,name,thumbnail_url},created_time",
      limit: "500",
    }
  );

  return response.data || [];
}

// ============================================
// Insights (Cost) Functions
// ============================================

/**
 * Get insights (spend, impressions, clicks) for ads
 */
export async function getAdInsights(
  accountId: string,
  accessToken: string,
  dateStart: string,
  dateEnd: string
): Promise<MetaAdInsights[]> {
  const formattedAccountId = accountId.startsWith("act_")
    ? accountId
    : `act_${accountId}`;

  const response = await metaApiRequest<MetaAdInsights>(
    `/${formattedAccountId}/insights`,
    accessToken,
    {
      fields: "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions",
      level: "ad",
      time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
      limit: "500",
    }
  );

  return (response.data || []).map((insight) => ({
    ...insight,
    impressions: parseInt(String(insight.impressions)) || 0,
    clicks: parseInt(String(insight.clicks)) || 0,
    spend: parseFloat(String(insight.spend)) || 0,
  }));
}

/**
 * Get campaign structure with adsets and ads
 */
export async function getCampaignStructure(
  accountId: string,
  accessToken: string
): Promise<{
  campaigns: MetaCampaign[];
  adsets: MetaAdSet[];
  ads: MetaAd[];
}> {
  const [campaigns, adsets, ads] = await Promise.all([
    getCampaigns(accountId, accessToken),
    getAccountAdSets(accountId, accessToken),
    getAccountAds(accountId, accessToken),
  ]);

  return { campaigns, adsets, ads };
}

// ============================================
// Token Validation
// ============================================

/**
 * Check if access token is still valid
 */
export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${META_API_BASE}/me?access_token=${accessToken}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Debug token to get info
 */
export async function debugToken(
  accessToken: string,
  appToken?: string
): Promise<{
  is_valid: boolean;
  expires_at: number;
  scopes: string[];
  user_id: string;
}> {
  const tokenToUse = appToken || accessToken;
  const response = await fetch(
    `${META_API_BASE}/debug_token?input_token=${accessToken}&access_token=${tokenToUse}`
  );
  const data = await response.json();

  return {
    is_valid: data.data?.is_valid || false,
    expires_at: data.data?.expires_at || 0,
    scopes: data.data?.scopes || [],
    user_id: data.data?.user_id || "",
  };
}

