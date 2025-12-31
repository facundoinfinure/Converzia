import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

// Build redirect URI - MUST be consistent between auth and callback
function getRedirectUri(): string {
  // Use explicit env var if set
  if (process.env.META_REDIRECT_URI) {
    return process.env.META_REDIRECT_URI;
  }
  
  // Use NEXT_PUBLIC_APP_URL (required for production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    // Ensure no trailing slash
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    return `${baseUrl}/api/integrations/meta/callback`;
  }
  
  // For Vercel deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/integrations/meta/callback`;
  }
  
  // Fallback for local dev
  return "http://localhost:3000/api/integrations/meta/callback";
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MetaUserResponse {
  id: string;
  name: string;
}

// GET /api/integrations/meta/callback - Handle Meta OAuth callback
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle errors from Meta
    if (error) {
      console.error("Meta OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        new URL(`/admin/settings?meta_error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/admin/settings?meta_error=missing_params", request.url)
      );
    }

    // Decode state
    let stateData: { user_id: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    } catch {
      return NextResponse.redirect(
        new URL("/admin/settings?meta_error=invalid_state", request.url)
      );
    }

    const { user_id } = stateData;

    // Validate state timestamp (5 minute expiry)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return NextResponse.redirect(
        new URL("/admin/settings?meta_error=expired", request.url)
      );
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      return NextResponse.redirect(
        new URL("/admin/settings?meta_error=config_missing", request.url)
      );
    }

    // Exchange code for access token
    const redirectUri = getRedirectUri();
    console.log("Meta OAuth callback - redirect URI:", redirectUri);
    
    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", META_APP_ID);
    tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData: MetaTokenResponse = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Failed to get Meta access token:", tokenData);
      return NextResponse.redirect(
        new URL("/admin/settings?meta_error=token_failed", request.url)
      );
    }

    // Exchange for long-lived token
    const longLivedUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", META_APP_ID);
    longLivedUrl.searchParams.set("client_secret", META_APP_SECRET);
    longLivedUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData: MetaTokenResponse = await longLivedResponse.json();

    const accessToken = longLivedData.access_token || tokenData.access_token;
    const expiresIn = longLivedData.expires_in || tokenData.expires_in || 3600;

    // Get user info
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`
    );
    const userData: MetaUserResponse = await userResponse.json();
    console.log("Meta user data:", userData);

    // Get ad accounts (for Marketing API)
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${accessToken}`
    );
    const adAccountsData = await adAccountsResponse.json();
    console.log("Ad accounts:", adAccountsData.data?.length || 0);

    // Get pages with page access tokens (for Lead Ads)
    let pagesData: any = { data: [] };
    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,category&access_token=${accessToken}`
      );
      pagesData = await pagesResponse.json();
      console.log("Pages:", pagesData.data?.length || 0);
    } catch (err) {
      console.error("Error fetching pages:", err);
    }

    // Get WhatsApp Business Accounts
    let wabaData: any = { data: [] };
    try {
      // First get the business accounts
      const businessResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?fields=id,name&access_token=${accessToken}`
      );
      const businessData = await businessResponse.json();
      
      // For each business, get the WhatsApp Business Accounts
      const wabas: any[] = [];
      for (const business of businessData.data || []) {
        const wabaResponse = await fetch(
          `https://graph.facebook.com/v18.0/${business.id}/owned_whatsapp_business_accounts?fields=id,name,currency,timezone_id&access_token=${accessToken}`
        );
        const wabaResult = await wabaResponse.json();
        if (wabaResult.data) {
          wabas.push(...wabaResult.data.map((waba: any) => ({
            ...waba,
            business_id: business.id,
            business_name: business.name,
          })));
        }
      }
      wabaData.data = wabas;
      console.log("WhatsApp Business Accounts:", wabas.length);
    } catch (err) {
      console.error("Error fetching WABA:", err);
    }

    // Get phone numbers for each WABA
    for (const waba of wabaData.data || []) {
      try {
        const phoneResponse = await fetch(
          `https://graph.facebook.com/v18.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&access_token=${accessToken}`
        );
        const phoneData = await phoneResponse.json();
        waba.phone_numbers = phoneData.data || [];
      } catch (err) {
        console.error("Error fetching phone numbers for WABA:", waba.id, err);
        waba.phone_numbers = [];
      }
    }

    const supabase = await createClient();

    // Store integration - Meta is a GLOBAL integration (Admin's account)
    // We store it without tenant_id so it can be used for all tenants
    // This unified integration includes Marketing API, Lead Ads, and WhatsApp
    const integrationData = {
      tenant_id: null, // Global integration, not tied to a specific tenant
      integration_type: "META_ADS" as const,
      name: `Meta - ${userData.name || "Connected"}`,
      status: "ACTIVE",
      is_active: true,
      config: {
        user_id: userData.id,
        user_name: userData.name,
        connected_by: user_id,
        // Marketing API assets
        ad_accounts: adAccountsData.data || [],
        // Lead Ads assets (Pages with their access tokens)
        pages: (pagesData.data || []).map((page: any) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          access_token: page.access_token, // Page Access Token for Lead Ads
        })),
        // WhatsApp assets
        whatsapp_business_accounts: wabaData.data || [],
        // Selected items (to be set in Settings UI)
        selected_page_id: (pagesData.data || [])[0]?.id || null,
        selected_waba_id: (wabaData.data || [])[0]?.id || null,
        selected_phone_number_id: (wabaData.data || [])[0]?.phone_numbers?.[0]?.id || null,
      },
      oauth_tokens: {
        access_token: accessToken,
        token_type: "bearer",
        expires_at: Date.now() + expiresIn * 1000,
        scope: "ads_read,ads_management,read_insights,pages_read_engagement,pages_show_list,leads_retrieval,whatsapp_business_messaging,whatsapp_business_management,business_management",
      },
    };

    // Check if a global Meta Ads integration already exists
    const { data: existing } = await supabase
      .from("tenant_integrations")
      .select("id")
      .eq("integration_type", "META_ADS")
      .is("tenant_id", null)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from("tenant_integrations")
        .update({
          ...integrationData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating Meta integration:", updateError);
        return NextResponse.redirect(
          new URL("/admin/settings?meta_error=save_failed", request.url)
        );
      }
    } else {
      // Create new
      const { error: insertError } = await supabase
        .from("tenant_integrations")
        .insert(integrationData);

      if (insertError) {
        console.error("Error creating Meta integration:", insertError);
        return NextResponse.redirect(
          new URL("/admin/settings?meta_error=save_failed", request.url)
        );
      }
    }

    // Redirect to settings page with success
    return NextResponse.redirect(
      new URL("/admin/settings?meta_success=true", request.url)
    );
  } catch (error) {
    console.error("Error in Meta OAuth callback:", error);
    return NextResponse.redirect(
      new URL("/admin/settings?meta_error=unknown", request.url)
    );
  }
}

