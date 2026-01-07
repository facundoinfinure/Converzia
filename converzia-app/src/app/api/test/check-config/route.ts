import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { handleForbidden, apiSuccess } from "@/lib/utils/api-error-handler";
import type { MetaIntegrationConfig, TenantIntegrationWithTokens } from "@/types/supabase-helpers";

/**
 * GET /api/test/check-config
 * 
 * Verifica que todas las configuraciones necesarias estén en su lugar
 * para que el flujo de leads de Meta → WhatsApp funcione.
 * 
 * Solo funciona en desarrollo o con TEST_SECRET.
 */
export async function GET(request: NextRequest) {
  // Seguridad
  const testSecret = request.headers.get("x-test-secret");
  const isProduction = process.env.NODE_ENV === "production";
  const hasValidSecret = testSecret === process.env.TEST_SECRET && process.env.TEST_SECRET;
  
  if (isProduction && !hasValidSecret) {
    return handleForbidden("No permitido en producción sin TEST_SECRET");
  }

  const supabase = createAdminClient();
  
  // Check for OAuth Meta integration first
  const { data: metaIntegration } = await supabase
    .from("tenant_integrations")
    .select("config, is_active")
    .eq("integration_type", "META_ADS")
    .is("tenant_id", null)
    .maybeSingle();

  const typedIntegration = metaIntegration as TenantIntegrationWithTokens | null;
  const hasMetaOAuth = !!(typedIntegration?.is_active && typedIntegration?.config);
  const metaConfig = typedIntegration?.config as MetaIntegrationConfig | null;
  const hasSelectedPage = hasMetaOAuth && !!metaConfig?.selected_pages && metaConfig.selected_pages.length > 0;
  
  // Obtener settings de app_settings
  interface AppSetting {
    key: string;
    value: string;
  }
  
  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "chatwoot_base_url",
      "chatwoot_account_id", 
      "chatwoot_api_token",
      "chatwoot_inbox_id",
      "meta_page_access_token",
    ]);

  const settingsMap: Record<string, string> = {};
  (settings || []).forEach((s: AppSetting) => {
    settingsMap[s.key] = s.value;
  });

  // Verificar configuraciones
  const checks = {
    meta: {
      META_APP_SECRET: !!process.env.META_APP_SECRET,
      META_WEBHOOK_VERIFY_TOKEN: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
      META_PAGE_ACCESS_TOKEN: !!(hasSelectedPage || process.env.META_PAGE_ACCESS_TOKEN || settingsMap.meta_page_access_token),
      META_OAUTH_CONNECTED: hasMetaOAuth,
    },
    chatwoot: {
      CHATWOOT_BASE_URL: !!(process.env.CHATWOOT_BASE_URL || settingsMap.chatwoot_base_url),
      CHATWOOT_ACCOUNT_ID: !!(process.env.CHATWOOT_ACCOUNT_ID || settingsMap.chatwoot_account_id),
      CHATWOOT_API_TOKEN: !!(process.env.CHATWOOT_API_TOKEN || settingsMap.chatwoot_api_token),
      CHATWOOT_INBOX_ID: !!(process.env.CHATWOOT_INBOX_ID || settingsMap.chatwoot_inbox_id),
    },
    openai: {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    },
    supabase: {
      SUPABASE_URL: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
      SUPABASE_KEY: !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  };

  // Calcular estado general
  const metaReady = Object.values(checks.meta).every(Boolean);
  const chatwootReady = Object.values(checks.chatwoot).every(Boolean);
  const openaiReady = Object.values(checks.openai).every(Boolean);
  const supabaseReady = Object.values(checks.supabase).every(Boolean);

  const allReady = metaReady && chatwootReady && openaiReady && supabaseReady;

  // Obtener conteo de ad_offer_map activos
  const { count: adMappingsCount } = await supabase
    .from("ad_offer_map")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return NextResponse.json({
    status: allReady ? "READY" : "INCOMPLETE",
    checks: {
      meta: {
        ready: metaReady,
        details: checks.meta,
        description: "Necesario para recibir y validar webhooks de Meta Lead Ads"
      },
      chatwoot: {
        ready: chatwootReady,
        details: checks.chatwoot,
        description: "Necesario para enviar mensajes de WhatsApp"
      },
      openai: {
        ready: openaiReady,
        details: checks.openai,
        description: "Necesario para el bot de calificación"
      },
      supabase: {
        ready: supabaseReady,
        details: checks.supabase,
        description: "Necesario para almacenar datos"
      },
    },
    adMappings: {
      count: adMappingsCount || 0,
      description: "Número de ads mapeados a ofertas (necesario para que los leads se procesen)"
    },
    tips: allReady ? [] : [
      !metaReady && "Conectá Meta en Configuración → Integraciones (o configura variables manualmente)",
      !chatwootReady && "Configura las variables de Chatwoot en .env.local o en app_settings",
      !openaiReady && "Configura OPENAI_API_KEY para el bot de calificación",
      (adMappingsCount || 0) === 0 && "No hay ads mapeados - los leads llegarán en estado PENDING_MAPPING",
      hasMetaOAuth && !hasSelectedPage && "Seleccioná una página en Configuración → Meta Business para recibir leads",
    ].filter(Boolean),
  });
}

