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

// ============================================
// Sync Functions
// ============================================

export interface TokkoPublication {
  id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  zone?: string;
  price_from?: number;
  price_to?: number;
  currency?: string;
  image_url?: string;
  updated_at?: string;
}

export interface TokkoTypology {
  id: number;
  name: string;
  bedrooms?: number;
  bathrooms?: number;
  area_m2?: number;
  price_from?: number;
  price_to?: number;
  currency?: string;
  total_units?: number;
  available_units?: number;
}

export interface SyncResult {
  success: boolean;
  offers_synced: number;
  variants_synced: number;
  errors: string[];
  message?: string;
}

/**
 * Sync publications (offers) from Tokko API
 */
export async function syncTokkoPublications(
  tenantId: string,
  config: TokkoConfig,
  forceFullSync: boolean = false
): Promise<SyncResult> {
  const supabase = await createClient();
  const apiUrl = config.api_url || TOKKO_API_BASE;
  const errors: string[] = [];
  let offersSynced = 0;
  let variantsSynced = 0;

  try {
    // Get integration ID for logging
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("id, last_sync_at")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "TOKKO")
      .eq("is_active", true)
      .single();

    if (!integration) {
      return {
        success: false,
        offers_synced: 0,
        variants_synced: 0,
        errors: ["Integración Tokko no encontrada o inactiva"],
      };
    }

    // Fetch publications from Tokko
    const publicationsResponse = await fetchWithTimeout(
      `${apiUrl}/publication/?key=${config.api_key}&format=json`,
      { method: "GET" },
      30000 // 30 seconds for publications fetch
    );

    if (!publicationsResponse.ok) {
      const errorText = await publicationsResponse.text();
      return {
        success: false,
        offers_synced: 0,
        variants_synced: 0,
        errors: [`Error al obtener publicaciones: HTTP ${publicationsResponse.status} - ${errorText}`],
      };
    }

    const publicationsData = await publicationsResponse.json();
    const publications: TokkoPublication[] = Array.isArray(publicationsData)
      ? publicationsData
      : publicationsData.publications || publicationsData.data || [];

    if (!Array.isArray(publications) || publications.length === 0) {
      return {
        success: true,
        offers_synced: 0,
        variants_synced: 0,
        errors: [],
        message: "No se encontraron publicaciones en Tokko",
      };
    }

    // Get existing offers mapped by external_id (we'll store Tokko ID in settings)
    const { data: existingOffers } = await supabase
      .from("offers")
      .select("id, settings")
      .eq("tenant_id", tenantId);

    const existingOffersMap = new Map<string, string>();
    (existingOffers || []).forEach((offer: any) => {
      const tokkoId = offer.settings?.tokko_publication_id;
      if (tokkoId) {
        existingOffersMap.set(String(tokkoId), offer.id);
      }
    });

    // Sync each publication
    for (const publication of publications) {
      try {
        const tokkoId = String(publication.id);
        const existingOfferId = existingOffersMap.get(tokkoId);

        // Generate slug from name
        const slug = generateSlug(publication.name);

        // Check if slug already exists (for new offers)
        let finalSlug = slug;
        if (!existingOfferId) {
          let slugCounter = 1;
          while (true) {
            const { data: existing } = await supabase
              .from("offers")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("slug", finalSlug)
              .maybeSingle();

            if (!existing) break;
            finalSlug = `${slug}-${slugCounter}`;
            slugCounter++;
          }
        }

        const offerData: any = {
          tenant_id: tenantId,
          name: publication.name,
          slug: finalSlug,
          offer_type: "PROPERTY",
          status: "ACTIVE",
          description: publication.description || null,
          city: publication.city || null,
          zone: publication.zone || null,
          address: publication.address || null,
          price_from: publication.price_from ? Number(publication.price_from) : null,
          price_to: publication.price_to ? Number(publication.price_to) : null,
          currency: publication.currency || "USD",
          image_url: publication.image_url || null,
          settings: {
            tokko_publication_id: tokkoId,
            tokko_synced_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        };

        if (existingOfferId) {
          // Update existing offer
          const { error: updateError } = await supabase
            .from("offers")
            .update(offerData)
            .eq("id", existingOfferId);

          if (updateError) {
            errors.push(`Error al actualizar oferta ${publication.name}: ${updateError.message}`);
            continue;
          }

          // Sync typologies for this publication
          const typologiesResult = await syncTokkoTypologies(
            existingOfferId,
            publication.id,
            config
          );
          variantsSynced += typologiesResult.variants_synced;
          if (typologiesResult.errors.length > 0) {
            errors.push(...typologiesResult.errors);
          }

          offersSynced++;
        } else {
          // Create new offer
          const { data: newOffer, error: insertError } = await supabase
            .from("offers")
            .insert(offerData)
            .select()
            .single();

          if (insertError || !newOffer) {
            errors.push(`Error al crear oferta ${publication.name}: ${insertError?.message || "Unknown error"}`);
            continue;
          }

          // Sync typologies for this publication
          const typologiesResult = await syncTokkoTypologies(
            (newOffer as any).id,
            publication.id,
            config
          );
          variantsSynced += typologiesResult.variants_synced;
          if (typologiesResult.errors.length > 0) {
            errors.push(...typologiesResult.errors);
          }

          offersSynced++;
        }
      } catch (error) {
        errors.push(`Error procesando publicación ${publication.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Update last_sync_at
    await supabase
      .from("tenant_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id);

    return {
      success: errors.length === 0,
      offers_synced: offersSynced,
      variants_synced: variantsSynced,
      errors,
      message: `Sincronización completada: ${offersSynced} ofertas, ${variantsSynced} variantes`,
    };
  } catch (error) {
    return {
      success: false,
      offers_synced: offersSynced,
      variants_synced: variantsSynced,
      errors: [error instanceof Error ? error.message : "Error desconocido"],
    };
  }
}

/**
 * Sync typologies (variants) for a specific publication
 */
async function syncTokkoTypologies(
  offerId: string,
  publicationId: number,
  config: TokkoConfig
): Promise<{ variants_synced: number; errors: string[] }> {
  const supabase = await createClient();
  const apiUrl = config.api_url || TOKKO_API_BASE;
  const errors: string[] = [];
  let variantsSynced = 0;

  try {
    // Fetch typologies from Tokko
    const typologiesResponse = await fetchWithTimeout(
      `${apiUrl}/publication/${publicationId}/typology/?key=${config.api_key}&format=json`,
      { method: "GET" },
      30000 // 30 seconds
    );

    if (!typologiesResponse.ok) {
      errors.push(`Error al obtener tipologías: HTTP ${typologiesResponse.status}`);
      return { variants_synced: 0, errors };
    }

    const typologiesData = await typologiesResponse.json();
    const typologies: TokkoTypology[] = Array.isArray(typologiesData)
      ? typologiesData
      : typologiesData.typologies || typologiesData.data || [];

    if (!Array.isArray(typologies) || typologies.length === 0) {
      return { variants_synced: 0, errors: [] };
    }

    // Get existing variants
    const { data: existingVariants } = await supabase
      .from("offer_variants")
      .select("id, code, settings")
      .eq("offer_id", offerId);

    const existingVariantsMap = new Map<string, string>();
    (existingVariants || []).forEach((variant: any) => {
      const tokkoId = variant.settings?.tokko_typology_id;
      if (tokkoId) {
        existingVariantsMap.set(String(tokkoId), variant.id);
      }
    });

    // Sync each typology
    for (let i = 0; i < typologies.length; i++) {
      const typology = typologies[i];
      try {
        const tokkoId = String(typology.id);
        const existingVariantId = existingVariantsMap.get(tokkoId);

        // Generate code if not provided
        const code = typology.id ? `T${typology.id}` : `V${i + 1}`;

        const variantData: any = {
          offer_id: offerId,
          name: typology.name,
          code,
          bedrooms: typology.bedrooms || null,
          bathrooms: typology.bathrooms || null,
          area_m2: typology.area_m2 ? Number(typology.area_m2) : null,
          price_from: typology.price_from ? Number(typology.price_from) : null,
          price_to: typology.price_to ? Number(typology.price_to) : null,
          currency: typology.currency || "USD",
          total_units: typology.total_units || null,
          available_units: typology.available_units || null,
          display_order: i,
          settings: {
            tokko_typology_id: tokkoId,
            tokko_synced_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        };

        if (existingVariantId) {
          // Update existing variant
          const { error: updateError } = await supabase
            .from("offer_variants")
            .update(variantData)
            .eq("id", existingVariantId);

          if (updateError) {
            errors.push(`Error al actualizar variante ${typology.name}: ${updateError.message}`);
            continue;
          }
        } else {
          // Create new variant
          const { error: insertError } = await supabase
            .from("offer_variants")
            .insert(variantData);

          if (insertError) {
            errors.push(`Error al crear variante ${typology.name}: ${insertError.message}`);
            continue;
          }
        }

        variantsSynced++;
      } catch (error) {
        errors.push(`Error procesando tipología ${typology.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { variants_synced: variantsSynced, errors };
  } catch (error) {
    return {
      variants_synced: variantsSynced,
      errors: [error instanceof Error ? error.message : "Error desconocido"],
    };
  }
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}















