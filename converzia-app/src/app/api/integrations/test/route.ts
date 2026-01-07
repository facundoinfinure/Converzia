import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { testTokkoConnection, TokkoConfig } from "@/lib/services/tokko";
import { testGoogleSheetsConnection, GoogleSheetsConfig } from "@/lib/services/google-sheets";
import { isAdminProfile } from "@/types/supabase-helpers";
import type { MembershipWithRole, TenantIntegrationWithTokens, GoogleOAuthTokens } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";
import { validateBody, integrationsTestBodySchema } from "@/lib/validation/schemas";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";

// ============================================
// Integration Test API
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, integrationsTestBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(bodyValidation.error);
    }
    
    const { type, config, tenant_id } = bodyValidation.data;

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

    const isAdmin = isAdminProfile(profile as { is_converzia_admin?: boolean } | null);

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

      const typedMembership = membership as MembershipWithRole | null;
      if (!typedMembership || !["OWNER", "ADMIN"].includes(typedMembership.role)) {
        return handleForbidden("No tienes acceso a este tenant");
      }
    }

    let result: { success: boolean; message: string };

    switch (type) {
      case "TOKKO":
        if (!isTokkoConfig(config)) {
          return handleValidationError("Configuración TOKKO inválida");
        }
        result = await testTokkoConnection(config);
        break;

      case "GOOGLE_SHEETS":
        if (!isGoogleSheetsConfig(config)) {
          return handleValidationError("Configuración GOOGLE_SHEETS inválida");
        }
        // For OAuth-based connections, get tokens from database
        const { data: integration } = await queryWithTimeout(
          supabase
            .from("tenant_integrations")
            .select("id, oauth_tokens")
            .eq("tenant_id", tenant_id)
            .eq("integration_type", "GOOGLE_SHEETS")
            .single(),
          10000,
          "get integration for test"
        );
        
        const typedIntegration = integration as TenantIntegrationWithTokens | null;
        const oauthTokens = (typedIntegration?.oauth_tokens || null) as GoogleOAuthTokens | null;
        const integrationId = typedIntegration?.id;
        
        result = await testGoogleSheetsConnection(
          config,
          oauthTokens,
          integrationId
        );
        break;

      case "WEBHOOK":
        if (!config || typeof config !== "object" || typeof (config as { url?: unknown }).url !== "string") {
          return handleValidationError("Configuración WEBHOOK inválida");
        }
        result = await testWebhookConnection((config as { url: string }).url);
        break;

      default:
        result = { success: false, message: "Tipo de integración desconocido" };
    }

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "POST /api/integrations/test" },
    });
  }
}

function isTokkoConfig(value: unknown): value is TokkoConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.api_key === "string" && v.api_key.length > 0;
}

function isGoogleSheetsConfig(value: unknown): value is GoogleSheetsConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.spreadsheet_id === "string" &&
    v.spreadsheet_id.length > 0 &&
    typeof v.sheet_name === "string" &&
    v.sheet_name.length > 0
  );
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

