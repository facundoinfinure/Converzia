import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const META_APP_ID = process.env.META_APP_ID;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`;

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!META_APP_ID) {
      return NextResponse.json(
        { error: "Meta App ID not configured" },
        { status: 500 }
      );
    }

    // Create state parameter - Meta integration is global (no tenant_id)
    const state = Buffer.from(
      JSON.stringify({
        user_id: user.id,
        timestamp: Date.now(),
      })
    ).toString("base64");

    // Build Meta OAuth URL
    // Scopes needed for reading ad metrics and costs
    const scopes = [
      "ads_read",
      "ads_management", 
      "read_insights",
    ].join(",");

    const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    authUrl.searchParams.set("client_id", META_APP_ID);
    authUrl.searchParams.set("redirect_uri", META_REDIRECT_URI);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.json({ url: authUrl.toString() });
  } catch (error) {
    console.error("Error initiating Meta OAuth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

