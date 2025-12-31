import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MetaOAuthTokens } from "@/lib/services/meta-ads";

const META_API_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// GET /api/integrations/meta/ad-status?ad_ids=123,456,789
// Returns the real-time status of ads from Meta
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
    const adIds = searchParams.get("ad_ids")?.split(",").filter(Boolean) || [];

    if (adIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    // Get Meta integration
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("integration_type", "META_ADS")
      .eq("is_active", true)
      .is("tenant_id", null)
      .maybeSingle();

    if (!integration) {
      // Try fallback to any active integration
      const { data: anyIntegration } = await supabase
        .from("tenant_integrations")
        .select("*")
        .eq("integration_type", "META_ADS")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!anyIntegration) {
        return NextResponse.json({ statuses: {}, error: "Meta not connected" });
      }
    }

    const finalIntegration = integration || null;
    if (!finalIntegration) {
      return NextResponse.json({ statuses: {} });
    }

    const tokens = finalIntegration.oauth_tokens as MetaOAuthTokens;
    if (!tokens?.access_token) {
      return NextResponse.json({ statuses: {}, error: "No access token" });
    }

    // Check token expiry
    if (tokens.expires_at && Date.now() > tokens.expires_at) {
      return NextResponse.json({ statuses: {}, error: "Token expired" });
    }

    // Batch query ads by ID (Meta supports up to 50 IDs per request)
    const statuses: Record<string, { status: string; effective_status?: string }> = {};
    const batchSize = 50;

    for (let i = 0; i < adIds.length; i += batchSize) {
      const batch = adIds.slice(i, i + batchSize);
      
      // Use batch request or individual queries
      await Promise.all(
        batch.map(async (adId) => {
          try {
            const url = `${META_API_BASE}/${adId}?fields=id,status,effective_status&access_token=${tokens.access_token}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.id) {
              statuses[adId] = {
                status: data.status,
                effective_status: data.effective_status,
              };
            }
          } catch (err) {
            // If individual ad query fails, skip it
            console.warn(`Failed to get status for ad ${adId}:`, err);
          }
        })
      );
    }

    return NextResponse.json({ statuses });
  } catch (error: any) {
    console.error("Error fetching Meta ad statuses:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch ad statuses", statuses: {} },
      { status: 500 }
    );
  }
}

