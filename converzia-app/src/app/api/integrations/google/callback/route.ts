import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

// ============================================
// Google OAuth - Callback Handler
// ============================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        `${APP_URL}/admin/tenants?error=google_auth_denied`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${APP_URL}/admin/tenants?error=google_auth_invalid`
      );
    }

    // Decode state to get tenant info
    let tenantId: string;
    let integrationId: string | null = null;
    try {
      const decodedState = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8")
      );
      tenantId = decodedState.tenantId;
      integrationId = decodedState.integrationId || null;
    } catch {
      return NextResponse.redirect(
        `${APP_URL}/admin/tenants?error=google_auth_invalid_state`
      );
    }

    // Validate environment
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${APP_URL}/admin/tenants/${tenantId}?error=google_not_configured`
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      `${APP_URL}/api/integrations/google/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error("Missing tokens from Google OAuth");
      return NextResponse.redirect(
        `${APP_URL}/admin/tenants/${tenantId}?error=google_auth_no_tokens`
      );
    }

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || "unknown";

    // Prepare OAuth tokens object
    const oauthTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date || Date.now() + 3600 * 1000,
      email,
      token_type: tokens.token_type || "Bearer",
      scope: tokens.scope || "",
    };

    // Save to database
    const supabase = await createClient();

    if (integrationId) {
      // Update existing integration
      const { error: updateError } = await supabase
        .from("tenant_integrations")
        .update({
          oauth_tokens: oauthTokens,
          status: "ACTIVE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integrationId);

      if (updateError) {
        console.error("Error updating integration:", updateError);
        return NextResponse.redirect(
          `${APP_URL}/admin/tenants/${tenantId}?error=google_auth_save_failed`
        );
      }
    } else {
      // Create new integration or update existing one for this tenant
      const { data: existing } = await supabase
        .from("tenant_integrations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "GOOGLE_SHEETS")
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from("tenant_integrations")
          .update({
            oauth_tokens: oauthTokens,
            status: "ACTIVE",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Error updating integration:", updateError);
          return NextResponse.redirect(
            `${APP_URL}/admin/tenants/${tenantId}?error=google_auth_save_failed`
          );
        }
      } else {
        // Create new integration
        const { error: insertError } = await supabase
          .from("tenant_integrations")
          .insert({
            tenant_id: tenantId,
            integration_type: "GOOGLE_SHEETS",
            name: "Google Sheets",
            config: {
              spreadsheet_id: "",
              sheet_name: "Leads",
            },
            oauth_tokens: oauthTokens,
            status: "PENDING_SETUP",
            is_active: false,
          });

        if (insertError) {
          console.error("Error creating integration:", insertError);
          return NextResponse.redirect(
            `${APP_URL}/admin/tenants/${tenantId}?error=google_auth_save_failed`
          );
        }
      }
    }

    // Redirect back to tenant page with success
    return NextResponse.redirect(
      `${APP_URL}/admin/tenants/${tenantId}?google_connected=true`
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(`${APP_URL}/admin/tenants?error=google_auth_failed`);
  }
}

