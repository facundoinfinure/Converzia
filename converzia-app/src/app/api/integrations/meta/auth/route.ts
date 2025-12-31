import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const META_APP_ID = process.env.META_APP_ID;

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
  
  // For local development
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/integrations/meta/callback`;
  }
  
  // Fallback for local dev
  return "http://localhost:3000/api/integrations/meta/callback";
}

// GET /api/integrations/meta/auth - Initiate Meta OAuth flow
// Meta Ads is a global integration (Admin connects their account)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Meta OAuth auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!META_APP_ID) {
      console.error("META_APP_ID not configured");
      return NextResponse.json(
        { error: "Meta App ID not configured. Check environment variables." },
        { status: 500 }
      );
    }

    const redirectUri = getRedirectUri();
    console.log("Meta OAuth redirect URI:", redirectUri);

    // Create state parameter - Meta integration is global (no tenant_id)
    const state = Buffer.from(
      JSON.stringify({
        user_id: user.id,
        timestamp: Date.now(),
      })
    ).toString("base64");

    // Build Meta OAuth URL with all necessary scopes for unified integration
    // Marketing API: ads_read, ads_management, read_insights
    // Lead Ads: pages_read_engagement, leads_retrieval, pages_manage_ads
    // WhatsApp: whatsapp_business_messaging, whatsapp_business_management
    // Business: business_management
    const scopes = [
      // Marketing API (Ads & Costs)
      "ads_read",
      "ads_management", 
      "read_insights",
      // Lead Ads
      "pages_read_engagement",
      "pages_show_list",
      "leads_retrieval",
      // WhatsApp Business
      "whatsapp_business_messaging",
      "whatsapp_business_management",
      // Business Management
      "business_management",
    ].join(",");

    const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    authUrl.searchParams.set("client_id", META_APP_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");

    console.log("Meta OAuth URL generated successfully");
    return NextResponse.json({ url: authUrl.toString() });
  } catch (error) {
    console.error("Error initiating Meta OAuth:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

