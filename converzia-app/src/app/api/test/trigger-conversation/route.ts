import { NextRequest, NextResponse } from "next/server";
import { startInitialConversation } from "@/lib/services/conversation";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { handleApiError, handleForbidden, handleValidationError, handleNotFound, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";
import type { LeadOfferWithRelations } from "@/types/supabase-helpers";
import { validateBody, testTriggerConversationBodySchema } from "@/lib/validation/schemas";

/**
 * POST /api/test/trigger-conversation
 * 
 * Endpoint de testing para disparar manualmente una conversación inicial.
 * Solo funciona en desarrollo o con TEST_SECRET configurado.
 * 
 * Body: { leadOfferId: string }
 */
export async function POST(request: NextRequest) {
  // Seguridad: Solo permitir en desarrollo o con secret
  const testSecret = request.headers.get("x-test-secret");
  const isProduction = process.env.NODE_ENV === "production";
  const hasValidSecret = testSecret === process.env.TEST_SECRET && process.env.TEST_SECRET;
  
  if (isProduction && !hasValidSecret) {
    return handleForbidden("No permitido en producción sin TEST_SECRET");
  }

  let leadOfferId: string | undefined;
  
  try {
    // Validate request body
    const bodyValidation = await validateBody(request, testTriggerConversationBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    leadOfferId = bodyValidation.data.leadOfferId;

    // Verificar que el lead_offer existe
    const supabase = createAdminClient();
    
    // Debug: Log the leadOfferId being searched
    logger.info(`[TEST] Searching for leadOfferId`, { leadOfferId, length: leadOfferId.length });
    
    // First try a simple query without joins
    const { data: simpleCheck, error: simpleError } = await queryWithTimeout(
      supabase
        .from("lead_offers")
        .select("id, status")
        .eq("id", leadOfferId.trim())
        .single(),
      5000,
      "check lead offer exists"
    );
    
    logger.info(`[TEST] Simple check result`, { hasData: !!simpleCheck, error: simpleError?.message });
    
    if (simpleError) {
      return handleNotFound(`Lead offer no encontrado: ${leadOfferId}`);
    }
    
    // Now get the full data - specify the FK relationship explicitly
    const { data: leadOffer, error } = await queryWithTimeout(
      supabase
        .from("lead_offers")
        .select(`
          id,
          status,
          lead:leads!lead_id(phone, full_name),
          offer:offers!offer_id(name),
          tenant:tenants!tenant_id(name)
        `)
        .eq("id", leadOfferId.trim())
        .single(),
      5000,
      "get lead offer details"
    );

    if (error || !leadOffer) {
      return NextResponse.json(
        { error: `Lead offer found but failed to load details: ${error?.message}` }, 
        { status: 500 }
      );
    }

    const typedLeadOffer = leadOffer as LeadOfferWithRelations;
    const lead = Array.isArray(typedLeadOffer.lead) ? typedLeadOffer.lead[0] : typedLeadOffer.lead;
    const offer = Array.isArray(typedLeadOffer.offer) ? typedLeadOffer.offer[0] : typedLeadOffer.offer;
    const tenant = Array.isArray(typedLeadOffer.tenant) ? typedLeadOffer.tenant[0] : typedLeadOffer.tenant;

    logger.info(`[TEST] Triggering conversation for lead_offer`, {
      leadOfferId,
      leadName: lead?.full_name,
      leadPhone: lead?.phone,
      offerName: offer?.name,
      tenantName: tenant?.name,
    });

    // Disparar la conversación inicial
    await startInitialConversation(leadOfferId);

    return apiSuccess({
      message: "Conversation started",
      details: {
        leadOfferId,
        phone: lead?.phone,
        offer: offer?.name,
        tenant: tenant?.name,
      }
    }, "Conversación iniciada correctamente");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al iniciar conversación de prueba",
      context: { leadOfferId: leadOfferId || "unknown" },
    });
  }
}

/**
 * GET /api/test/trigger-conversation
 * 
 * Información del endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/test/trigger-conversation",
    method: "POST",
    description: "Triggers initial WhatsApp conversation for a lead_offer",
    body: {
      leadOfferId: "UUID of the lead_offer to trigger"
    },
    headers: {
      "x-test-secret": "Required in production (matches TEST_SECRET env var)"
    },
    security: "Only works in development or with valid TEST_SECRET"
  });
}

