import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`;

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
        new URL(`/admin/tenants?meta_error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/admin/tenants?meta_error=missing_params", request.url)
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
    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", META_APP_ID);
    tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", META_REDIRECT_URI);
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

    // Get ad accounts
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${accessToken}`
    );
    const adAccountsData = await adAccountsResponse.json();

    const supabase = await createClient();

    // Store integration - Meta Ads is a GLOBAL integration (Admin's account)
    // We store it without tenant_id so it can be used for all tenants
    const integrationData = {
      tenant_id: null, // Global integration, not tied to a specific tenant
      integration_type: "META_ADS" as const,
      name: `Meta Ads - ${userData.name || "Connected"}`,
      status: "ACTIVE",
      is_active: true,
      config: {
        user_id: userData.id,
        user_name: userData.name,
        ad_accounts: adAccountsData.data || [],
        connected_by: user_id, // Track which admin connected it
      },
      oauth_tokens: {
        access_token: accessToken,
        token_type: "bearer",
        expires_at: Date.now() + expiresIn * 1000,
        scope: "ads_read,ads_management,read_insights",
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

    // Redirect to ads mapping page with success
    return NextResponse.redirect(
      new URL("/admin/ads-mapping?meta_success=true", request.url)
    );
  } catch (error) {
    console.error("Error in Meta OAuth callback:", error);
    return NextResponse.redirect(
      new URL("/admin/settings?meta_error=unknown", request.url)
    );
  }
}

