import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateBody, metaConfigBodySchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { TenantIntegrationWithTokens, MetaIntegrationConfig, MetaOAuthTokens } from "@/types/supabase-helpers";

// GET /api/integrations/meta/config - Get Meta integration config
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para ver la configuración de Meta");
    }

    // Get global Meta integration
    const { data: integration, error } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("integration_type", "META_ADS")
      .is("tenant_id", null)
      .maybeSingle();

    if (error) {
      return handleApiError(error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo obtener la integración de Meta",
        context: { operation: "get_meta_config" },
      });
    }

    if (!integration) {
      return apiSuccess({ connected: false });
    }

    const typedIntegration = integration as TenantIntegrationWithTokens;
    const config = typedIntegration.config as MetaIntegrationConfig;
    const oauthTokens = typedIntegration.oauth_tokens as MetaOAuthTokens | null;
    
    // Check if token is expired
    const tokenExpired = oauthTokens?.expires_at ? Date.now() > oauthTokens.expires_at : false;

    return NextResponse.json({
      connected: true,
      token_expired: tokenExpired,
      user_name: config?.user_name,
      ad_accounts: config?.ad_accounts || [],
      pages: (config?.pages || []).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        // Don't expose access_token to client
      })),
      whatsapp_business_accounts: (config?.whatsapp_business_accounts || []).map((waba) => ({
        id: waba.id,
        name: waba.name,
        business_name: waba.business_name,
        phone_numbers: waba.phone_numbers || [],
      })),
      selected_ad_account_id: config?.selected_ad_account_id,
      selected_page_id: config?.selected_page_id,
      selected_waba_id: config?.selected_waba_id,
      selected_phone_number_id: config?.selected_phone_number_id,
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al obtener configuración de Meta",
      context: { operation: "get_meta_config" },
    });
  }
}

// PATCH /api/integrations/meta/config - Update selected items
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para actualizar la configuración de Meta");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, metaConfigBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { 
      selected_ad_accounts, 
      selected_pages, 
      selected_whatsapp_accounts 
    } = bodyValidation.data;
    
    // Map new format to legacy format for backwards compatibility
    const selected_ad_account_id = selected_ad_accounts?.[0];
    const selected_page_id = selected_pages?.[0];
    const selected_waba_id = selected_whatsapp_accounts?.[0];

    // Get existing integration
    const { data: integration, error: fetchError } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("integration_type", "META_ADS")
      .is("tenant_id", null)
      .maybeSingle();

    if (fetchError || !integration) {
      return handleApiError(new Error("Meta integration not found"), {
        code: ErrorCode.NOT_FOUND,
        status: 404,
        message: "No se encontró la integración de Meta",
        context: { operation: "update_meta_config" },
      });
    }

    // Update config with selected items (new format)
    const typedIntegration = integration as TenantIntegrationWithTokens;
    const currentConfig = typedIntegration.config as MetaIntegrationConfig;
    const updatedConfig: MetaIntegrationConfig = {
      ...currentConfig,
      ...(selected_ad_accounts !== undefined && { selected_ad_accounts }),
      ...(selected_pages !== undefined && { selected_pages }),
      ...(selected_whatsapp_accounts !== undefined && { selected_whatsapp_accounts }),
      // Legacy fields for backwards compatibility
      ...(selected_ad_account_id !== undefined && { selected_ad_account_id }),
      ...(selected_page_id !== undefined && { selected_page_id }),
      ...(selected_waba_id !== undefined && { selected_waba_id }),
    };

    const { error: updateError } = await supabase
      .from("tenant_integrations")
      .update({
        config: updatedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    if (updateError) {
      return handleApiError(updateError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo actualizar la configuración",
        context: { operation: "update_meta_config" },
      });
    }

    return apiSuccess(null, "Configuración actualizada correctamente");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al actualizar configuración de Meta",
      context: { operation: "update_meta_config" },
    });
  }
}

