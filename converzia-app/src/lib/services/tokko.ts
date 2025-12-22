import { createClient } from "@/lib/supabase/server";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";
import type { Delivery, TenantIntegration, QualificationFields, ScoreBreakdown } from "@/types";

// ============================================
// Tokko CRM Integration Service
// API Documentation: https://developers.tokkobroker.com/
// ============================================

const TOKKO_API_BASE = "https://www.tokkobroker.com/api/v1";

export interface TokkoConfig {
  api_key: string;
  api_url?: string;
  publication_id_field?: string; // Optional: field to map to publication_id
}

export interface TokkoWebContact {
  name: string;
  mail: string;
  phone: string;
  comment: string;
  publication_id?: string;
  tags?: string[];
}

export interface TokkoResponse {
  success: boolean;
  contact_id?: string;
  message?: string;
  error?: string;
}

// ============================================
// Main Functions
// ============================================

/**
 * Create a lead/contact in Tokko CRM
 */
export async function createTokkoLead(
  delivery: Delivery,
  config: TokkoConfig
): Promise<TokkoResponse> {
  const apiUrl = config.api_url || TOKKO_API_BASE;
  const endpoint = `${apiUrl}/webcontact/?key=${config.api_key}`;

  // Build the Tokko payload from delivery data
  const payload = buildTokkoPayload(delivery, config);

  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      15000 // 15 seconds for Tokko API
    );

    // Tokko returns 200 even on some errors, need to check response body
    const responseText = await response.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
      };
    }

    // Log the sync
    await logTokkoSync(delivery, payload, responseData, response.status, null);

    return {
      success: true,
      contact_id: responseData.id || responseData.contact_id,
      message: "Lead created successfully in Tokko",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Log the error
    await logTokkoSync(delivery, null, null, null, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Build Tokko payload from Converzia delivery
 */
function buildTokkoPayload(
  delivery: Delivery,
  config: TokkoConfig
): TokkoWebContact {
  const payload = delivery.payload;
  const lead = payload.lead || {};
  const qualification = (payload.qualification || {}) as QualificationFields;
  const score = payload.score || {};

  // Build comprehensive comment with all lead information
  const comment = buildTokkoComment(payload);

  const tokkoPayload: TokkoWebContact = {
    name: lead.name || "Sin nombre",
    mail: lead.email || "noemail@converzia.com",
    phone: formatPhoneForTokko(lead.phone || ""),
    comment: comment,
  };

  // Add publication_id if configured and available
  if (config.publication_id_field && payload.recommended_offer) {
    tokkoPayload.publication_id = String(payload.recommended_offer.id);
  }

  return tokkoPayload;
}

/**
 * Build detailed comment for Tokko
 * Includes: qualification summary, score explanation, conversation summary
 */
function buildTokkoComment(payload: Delivery["payload"]): string {
  const lead = payload.lead || {};
  const qualification = (payload.qualification || {}) as QualificationFields;
  const score = payload.score || {};
  const breakdown = (score.breakdown || {}) as ScoreBreakdown;

  const parts: string[] = [];

  // Header
  parts.push("🤖 Lead calificado por Converzia");
  parts.push("═".repeat(40));

  // Contact info
  parts.push("\n📋 INFORMACIÓN DE CONTACTO:");
  parts.push(`• Nombre: ${lead.name || "No especificado"}`);
  parts.push(`• Teléfono: ${lead.phone || "No especificado"}`);
  parts.push(`• Email: ${lead.email || "No especificado"}`);

  // Qualification data
  parts.push("\n🎯 CALIFICACIÓN:");
  
  if (qualification.budget) {
    const min = qualification.budget.min
      ? `USD ${qualification.budget.min.toLocaleString()}`
      : "No especificado";
    const max = qualification.budget.max
      ? `USD ${qualification.budget.max.toLocaleString()}`
      : "No especificado";
    parts.push(`• Presupuesto: ${min} - ${max}`);
  }

  if (qualification.zone && qualification.zone.length > 0) {
    parts.push(`• Zonas de interés: ${qualification.zone.join(", ")}`);
  }

  if (qualification.bedrooms) {
    parts.push(`• Tipología: ${qualification.bedrooms} ambientes`);
  }

  if (qualification.timing) {
    parts.push(`• Timing: ${qualification.timing}`);
  }

  if (qualification.financing !== undefined) {
    parts.push(`• Necesita financiamiento: ${qualification.financing ? "Sí" : "No"}`);
  }

  if (qualification.is_investor) {
    parts.push(`• Perfil: Inversor`);
  }

  // Property of interest
  if (payload.recommended_offer) {
    parts.push(`\n🏠 PROPIEDAD DE INTERÉS:`);
    parts.push(`• ${payload.recommended_offer.name}`);
  }

  // Score
  parts.push("\n📊 SCORE CONVERZIA:");
  parts.push(`• Puntaje total: ${score.total || 0}/100`);
  
  if (breakdown) {
    parts.push("\n📈 DESGLOSE DEL SCORE:");
    if (breakdown.budget !== undefined) parts.push(`  - Presupuesto: ${breakdown.budget} pts`);
    if (breakdown.zone !== undefined) parts.push(`  - Zona: ${breakdown.zone} pts`);
    if (breakdown.timing !== undefined) parts.push(`  - Timing: ${breakdown.timing} pts`);
    if (breakdown.completeness !== undefined) parts.push(`  - Completitud: ${breakdown.completeness} pts`);
    if (breakdown.investor_bonus !== undefined) parts.push(`  - Bonus inversor: ${breakdown.investor_bonus} pts`);
  }

  // Conversation summary
  if (payload.conversation_summary) {
    parts.push("\n💬 RESUMEN DE CONVERSACIÓN:");
    parts.push(payload.conversation_summary);
  }

  // Footer
  parts.push("\n" + "═".repeat(40));
  parts.push(`Generado: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`);

  return parts.join("\n");
}

/**
 * Format phone for Tokko (they expect digits only or with country code)
 */
function formatPhoneForTokko(phone: string): string {
  // Remove all non-digit characters except leading +
  return phone.replace(/[^\d+]/g, "");
}

/**
 * Log Tokko sync to database
 */
async function logTokkoSync(
  delivery: Delivery,
  requestPayload: TokkoWebContact | null,
  responsePayload: any,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    const supabase = await createClient();

    // Get integration ID
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("id")
      .eq("tenant_id", delivery.tenant_id)
      .eq("integration_type", "TOKKO")
      .eq("is_active", true)
      .single();

    if (!integration) return;

    const startedAt = new Date();
    const completedAt = new Date();

    await supabase.from("integration_sync_logs").insert({
      integration_id: integration.id,
      delivery_id: delivery.id,
      sync_type: "LEAD_DELIVERY",
      status: errorMessage ? "FAILED" : "SUCCESS",
      request_payload: requestPayload ? { ...requestPayload, api_key: "[REDACTED]" } : null,
      response_payload: responsePayload,
      response_status_code: statusCode,
      error_message: errorMessage,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_ms: completedAt.getTime() - startedAt.getTime(),
    });
  } catch (error) {
    console.error("Error logging Tokko sync:", error);
  }
}

// ============================================
// Test Connection
// ============================================

/**
 * Test Tokko API connection
 */
export async function testTokkoConnection(config: TokkoConfig): Promise<{
  success: boolean;
  message: string;
}> {
  const apiUrl = config.api_url || TOKKO_API_BASE;
  
  try {
    // Try to fetch a simple endpoint to verify the API key
    const response = await fetchWithTimeout(
      `${apiUrl}/?key=${config.api_key}&format=json`,
      { method: "GET" },
      10000 // 10 seconds for connection test
    );

    if (response.status === 401) {
      return {
        success: false,
        message: "API key inválida o sin permisos",
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: `Error de conexión: HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      message: "Conexión exitosa con Tokko CRM",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error de conexión",
    };
  }
}

// ============================================
// Helper: Get Tokko Config for Tenant
// ============================================

export async function getTokkoConfig(tenantId: string): Promise<TokkoConfig | null> {
  const supabase = await createClient();

  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "TOKKO")
    .eq("is_active", true)
    .single();

  if (!integration) return null;

  return integration.config as TokkoConfig;
}








