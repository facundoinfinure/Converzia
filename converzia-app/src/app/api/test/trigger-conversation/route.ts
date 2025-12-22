import { NextRequest, NextResponse } from "next/server";
import { startInitialConversation } from "@/lib/services/conversation";
import { createAdminClient } from "@/lib/supabase/server";

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
    return NextResponse.json(
      { error: "Not allowed in production without TEST_SECRET" }, 
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { leadOfferId } = body;
    
    if (!leadOfferId) {
      return NextResponse.json(
        { error: "leadOfferId is required" }, 
        { status: 400 }
      );
    }

    // Verificar que el lead_offer existe
    const supabase = createAdminClient();
    const { data: leadOffer, error } = await supabase
      .from("lead_offers")
      .select(`
        id,
        status,
        lead:leads(phone, full_name),
        offer:offers(name),
        tenant:tenants(name)
      `)
      .eq("id", leadOfferId)
      .single();

    if (error || !leadOffer) {
      return NextResponse.json(
        { error: `Lead offer not found: ${leadOfferId}` }, 
        { status: 404 }
      );
    }

    const lead = Array.isArray(leadOffer.lead) ? leadOffer.lead[0] : leadOffer.lead;
    const offer = Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer;
    const tenant = Array.isArray(leadOffer.tenant) ? leadOffer.tenant[0] : leadOffer.tenant;

    console.log(`[TEST] Triggering conversation for lead_offer: ${leadOfferId}`);
    console.log(`[TEST] Lead: ${lead?.full_name} (${lead?.phone})`);
    console.log(`[TEST] Offer: ${offer?.name}`);
    console.log(`[TEST] Tenant: ${tenant?.name}`);

    // Disparar la conversación inicial
    await startInitialConversation(leadOfferId);

    return NextResponse.json({ 
      success: true, 
      message: "Conversation started",
      details: {
        leadOfferId,
        phone: lead?.phone,
        offer: offer?.name,
        tenant: tenant?.name,
      }
    });
  } catch (error) {
    console.error("[TEST] Error starting conversation:", error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
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

