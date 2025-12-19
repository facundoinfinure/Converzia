import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { testTokkoConnection, TokkoConfig } from "@/lib/services/tokko";
import { testGoogleSheetsConnection, GoogleSheetsConfig } from "@/lib/services/google-sheets";

// ============================================
// Integration Test API
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, config, tenant_id } = body;

    if (!type || !config || !tenant_id) {
      return NextResponse.json(
        { success: false, message: "Missing type, config, or tenant_id" },
        { status: 400 }
      );
    }

    // Verify membership or Converzia admin
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile for integration test"
    );

    const isAdmin = !!(profile as any)?.is_converzia_admin;

    if (!isAdmin) {
      const { data: membership } = await queryWithTimeout(
        supabase
          .from("tenant_members")
          .select("role")
          .eq("tenant_id", tenant_id)
          .eq("user_id", user.id)
          .eq("status", "ACTIVE")
          .single(),
        10000,
        "get tenant membership for integration test"
      );

      if (!membership || !["OWNER", "ADMIN"].includes((membership as any).role)) {
        return NextResponse.json({ success: false, message: "No access" }, { status: 403 });
      }
    }

    let result: { success: boolean; message: string };

    switch (type) {
      case "TOKKO":
        result = await testTokkoConnection(config as TokkoConfig);
        break;

      case "GOOGLE_SHEETS":
        result = await testGoogleSheetsConnection(config as GoogleSheetsConfig);
        break;

      case "WEBHOOK":
        result = await testWebhookConnection(config.url);
        break;

      default:
        result = { success: false, message: "Unknown integration type" };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Integration test error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("172.16.") ||
    h.startsWith("172.17.") ||
    h.startsWith("172.18.") ||
    h.startsWith("172.19.") ||
    h.startsWith("172.2") || // includes 172.20-172.29
    h.startsWith("172.30.") ||
    h.startsWith("172.31.") ||
    h === "169.254.169.254"
  );
}

async function testWebhookConnection(url: string): Promise<{ success: boolean; message: string }> {
  if (!url) {
    return { success: false, message: "URL is required" };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { success: false, message: "Only https:// URLs are allowed" };
    }
    if (isPrivateHostname(parsed.hostname)) {
      return { success: false, message: "Private/localhost destinations are not allowed" };
    }
    if (parsed.username || parsed.password) {
      return { success: false, message: "Credentials in URL are not allowed" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Try to reach the webhook endpoint with a HEAD request
    const response = await fetchWithTimeout(
      url,
      {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Converzia-Test/1.0",
        },
      },
      5000 // 5 seconds for webhook test
    ).finally(() => clearTimeout(timeout));

    if (response.ok || response.status === 405) {
      // 405 Method Not Allowed is acceptable (endpoint exists but doesn't accept HEAD)
      return { success: true, message: "Endpoint accesible" };
    }

    return {
      success: false,
      message: `Endpoint responded with status ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

