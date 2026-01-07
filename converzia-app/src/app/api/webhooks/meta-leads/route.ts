import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout, rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import { unsafeRpc } from "@/lib/supabase/unsafe-rpc";
import { startInitialConversation } from "@/lib/services/conversation";
import { validateMetaSignature } from "@/lib/security/webhook-validation";
import { withRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/security/rate-limit";
import { encryptPII, isPIIEncryptionEnabled } from "@/lib/security/crypto";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { normalizePhone } from "@/lib/utils";
import { handleApiError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger, Metrics, Alerts, generateTraceId, setTraceId } from "@/lib/monitoring";
import type { MetaWebhookPayload, MetaLeadData, TenantIntegrationWithTokens, MetaIntegrationConfig, AdOfferMapping, AppSetting, UpsertLeadSourceResult } from "@/types/supabase-helpers";
import type { Lead, LeadOffer } from "@/types/database";

// ============================================
// Meta Lead Ads Webhook Handler
// ============================================

// Verify webhook (Facebook sends this on setup)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Get verify token from environment or settings
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    logger.error("META_WEBHOOK_VERIFY_TOKEN not configured", undefined, {});
      return handleApiError(new Error("META_WEBHOOK_VERIFY_TOKEN not configured"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "Error de configuración del servidor",
        context: { operation: "meta_webhook_verification" },
      });
  }

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("Meta webhook verified successfully", {});
    return new Response(challenge, { status: 200 });
  }

  logger.warn("Meta webhook verification failed", { mode, tokenMatch: token === verifyToken });
  return handleApiError(new Error("Verification failed"), {
    code: ErrorCode.VALIDATION_ERROR,
    status: 403,
    message: "Verificación del webhook fallida",
    context: { operation: "meta_webhook_verification" },
  });
}

// Handle incoming leads
export async function POST(request: NextRequest) {
  // Set trace ID for this request
  setTraceId(generateTraceId());

  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.webhook);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Validate Meta signature - REQUIRED for security
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.META_APP_SECRET;
    
    if (!appSecret) {
      logger.security("META_APP_SECRET not configured - webhook rejected");
      Metrics.webhookReceived("meta", "error");
      return handleApiError(new Error("META_APP_SECRET not configured"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "Error de configuración del servidor",
        context: { operation: "meta_webhook_post" },
      });
    }
    
    const isValid = validateMetaSignature(rawBody, signature, appSecret);
    if (!isValid) {
      logger.security("Invalid Meta webhook signature", {
        ip: getClientIdentifier(request).substring(0, 8) + "...",
        hasSignature: !!signature,
      });
      Alerts.webhookSignatureInvalid("meta", getClientIdentifier(request));
      Metrics.webhookReceived("meta", "error");
      return handleApiError(new Error("Invalid webhook signature"), {
        code: ErrorCode.VALIDATION_ERROR,
        status: 401,
        message: "Firma del webhook inválida",
        context: { operation: "meta_webhook_signature_validation" },
      });
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return handleApiError(new Error("Invalid JSON payload"), {
        code: ErrorCode.VALIDATION_ERROR,
        status: 400,
        message: "Payload JSON inválido",
        context: { operation: "meta_webhook_parse" },
      });
    }

    // Validate Facebook webhook payload
    if (payload.object !== "page" && payload.object !== "instagram") {
      return new NextResponse(JSON.stringify({ status: "ignored" }), { status: 200 });
    }

    logger.webhook("meta", { object: payload.object, entries: payload.entry?.length || 0 });

    const supabase = createAdminClient();

    // Process each entry
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const leadgenData = change.value as NonNullable<MetaWebhookPayload["entry"][number]["changes"][number]["value"]>;
        const adId = leadgenData.ad_id;
        const formId = leadgenData.form_id;
        const leadgenId = leadgenData.leadgen_id;
        const createdTime = leadgenData.created_time ? new Date(leadgenData.created_time * 1000) : new Date();

        if (!adId || !leadgenId) {
          logger.warn("Meta leadgen change missing ad_id or leadgen_id");
          continue;
        }

        // Resolve tenant/offer by ad_id (ad_id is unique per tenant in this product)
        const { data: adMapping, error: adMappingError } = await supabase
          .from("ad_offer_map")
          .select("tenant_id, offer_id")
          .eq("ad_id", adId)
          .eq("is_active", true)
          .maybeSingle();

        if (adMappingError) {
          logger.error("Error fetching ad mapping", { error: adMappingError, adId });
          continue;
        }

        if (!adMapping || !adMapping.tenant_id) {
          logger.warn("Unknown ad_id (no tenant mapping)", { adId });
          continue;
        }

        // Fetch lead details from Facebook Graph API
        const leadData = await fetchLeadDetails(leadgenId);

        if (!leadData || !leadData.field_data) {
          logger.error("Could not fetch lead details or missing field_data", { leadgenId, hasData: !!leadData });
          continue;
        }

        // Extract fields from lead data
        const fields = leadData.field_data;
        const extractedData = extractLeadFields(fields);

        // Normalize phone number
        const phoneE164 = normalizePhone(extractedData.phone || "");

        if (!phoneE164) {
          logger.error("Lead has no valid phone", { leadgenId });
          continue;
        }

        // Upsert lead
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .upsert({
            phone: phoneE164,
            email: extractedData.email || null,
            first_name: extractedData.firstName || null,
            last_name: extractedData.lastName || null,
            full_name: extractedData.fullName || null,
            country_code: "AR", // Default, could be extracted
          }, {
            onConflict: "phone",
          })
          .select()
          .single() as { data: Lead | null; error: { message?: string } | null };

        if (leadError || !lead) {
          logger.error("Error upserting lead", { error: leadError?.message });
          continue;
        }

        Metrics.leadCreated("meta");

        // Idempotency: Use atomic upsert function to handle race conditions
        // This prevents duplicate lead_sources when Meta retries the webhook
        const { data: sourceResult, error: sourceError } = await rpcWithTimeout<
          UpsertLeadSourceResult | UpsertLeadSourceResult[]
        >(
          unsafeRpc<UpsertLeadSourceResult | UpsertLeadSourceResult[]>(supabase, "upsert_lead_source", {
            p_lead_id: lead.id,
            p_tenant_id: adMapping.tenant_id,
            p_leadgen_id: leadgenId,
            p_platform: "META",
            p_ad_id: adId,
            p_campaign_id: leadgenData.campaign_id || null,
            p_adset_id: leadgenData.adset_id || null,
            p_form_id: formId || null,
            p_form_data: {
              leadgen: leadgenData,
              lead: leadData,
              received_at: new Date().toISOString(),
            },
          }),
          15000,
          "upsert_lead_source",
          true
        );

        if (sourceError) {
          logger.error("Error upserting lead source", { error: sourceError.message, leadgenId });
          continue;
        }

        const sourceRow: UpsertLeadSourceResult | null = Array.isArray(sourceResult) 
          ? sourceResult[0] 
          : (sourceResult || null);
        const leadSourceId = sourceRow?.lead_source_id;
        const wasNewSource = sourceRow?.was_created || false;

        // If source already existed, this is a duplicate webhook - skip processing
        if (!wasNewSource && leadSourceId) {
          logger.info("Duplicate leadgen_id received (idempotent skip)", { 
            leadgenId, 
            tenantId: adMapping.tenant_id 
          });
          continue;
        }

        const offerId = adMapping.offer_id || null;
        const status = offerId ? "TO_BE_CONTACTED" : "PENDING_MAPPING";

        // Basic prefill fields from Meta form (no DNI storage here)
        const prefillQualification: Record<string, unknown> = {
          ...(extractedData.fullName ? { name: extractedData.fullName } : {}),
          ...(extractedData.purpose ? { purpose: extractedData.purpose } : {}),
          ...(extractedData.purpose === "Inversión" ? { is_investor: true } : {}),
          meta: {
            ad_id: adId,
            leadgen_id: leadgenId,
            form_id: formId,
          },
        };

        let leadOffer: { id: string } | null = null;

        if (offerId) {
          const { data: upsertedLeadOffer, error: upsertError } = await supabase
            .from("lead_offers")
            .upsert(
              {
                lead_id: lead.id,
                tenant_id: adMapping.tenant_id,
                offer_id: offerId,
                lead_source_id: leadSourceId || null,
                status,
                qualification_fields: prefillQualification,
              },
              { onConflict: "lead_id,offer_id,tenant_id" }
            )
            .select("id")
            .single() as { data: { id: string } | null; error: { message?: string } | null };

          if (upsertError) {
            logger.error("Error upserting lead offer", { error: upsertError.message, leadgenId });
            continue;
          }
          leadOffer = upsertedLeadOffer;
        } else {
          // For unmapped ads we still create a tenant-scoped lead_offer (offer_id null)
          const { data: existingPending } = await supabase
            .from("lead_offers")
            .select("id")
            .eq("lead_id", lead.id)
            .eq("tenant_id", adMapping.tenant_id)
            .is("offer_id", null)
            .eq("status", "PENDING_MAPPING")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle() as { data: { id: string } | null; error: unknown };

          if (existingPending?.id) {
            leadOffer = { id: existingPending.id };
          } else {
            const { data: insertedLeadOffer, error: insertError } = await supabase
              .from("lead_offers")
              .insert({
                lead_id: lead.id,
                tenant_id: adMapping.tenant_id,
                offer_id: null,
                lead_source_id: leadSourceId || null,
                status,
                qualification_fields: prefillQualification,
              })
              .select("id")
              .single() as { data: { id: string } | null; error: { message?: string } | null };

            if (insertError) {
              logger.error("Error inserting lead offer", { error: insertError.message, leadgenId });
              continue;
            }
            leadOffer = insertedLeadOffer;
          }
        }

        // Log event with trace_id for audit trail
        const { getTraceId } = await import("@/lib/monitoring");
        await supabase.from("lead_events").insert({
          lead_id: lead.id,
          lead_offer_id: leadOffer?.id || null,
          tenant_id: adMapping.tenant_id,
          event_type: "CREATED",
          details: {
            source: "META_LEAD_AD",
            ad_id: adId,
            form_id: formId,
            leadgen_id: leadgenId,
          },
          actor_type: "SYSTEM",
          trace_id: getTraceId() || null,
        });

        // If mapped, trigger initial conversation
        if (offerId && leadOffer?.id) {
          try {
            await startInitialConversation(leadOffer.id);
          } catch (err) {
            logger.exception("Error starting conversation", err, { leadOfferId: leadOffer.id });
          }
        }
      }
    }

    Metrics.webhookReceived("meta", "success");
    return apiSuccess({ processed: true }, "Webhook procesado correctamente");
  } catch (error) {
    logger.exception("Meta webhook error", error);
    Metrics.webhookReceived("meta", "error");
    Metrics.errorOccurred("webhook", "meta");
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error interno al procesar webhook",
      context: { operation: "meta_webhook_process" },
    });
  }
}

// ============================================
// Helper Functions
// ============================================

async function fetchLeadDetails(leadgenId: string): Promise<MetaLeadData | null> {
  const supabase = createAdminClient();
  let accessToken: string | null = null;

  // First, try to get Page Access Token from unified OAuth integration
  const { data: metaIntegration } = await supabase
    .from("tenant_integrations")
    .select("config")
    .eq("integration_type", "META_ADS")
    .is("tenant_id", null)
    .eq("is_active", true)
    .maybeSingle() as { data: TenantIntegrationWithTokens | null; error: unknown };

  if (metaIntegration?.config) {
    const config = metaIntegration.config as MetaIntegrationConfig;
    const selectedPageId = config.selected_page_id;
    const pages = config.pages || [];
    
    // Find the selected page's access token
    const selectedPage = pages.find((p) => p.id === selectedPageId);
    if (selectedPage?.access_token) {
      accessToken = selectedPage.access_token;
      logger.info("Using OAuth Page Access Token for lead fetch", { pageId: selectedPageId });
    }
  }

  // Fallback to legacy settings if OAuth not configured
  if (!accessToken) {
    const { data: setting } = await queryWithTimeout(
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "meta_page_access_token")
        .single(),
      10000,
      "get Meta access token",
      false // Don't retry settings
    ) as { data: AppSetting | null; error: unknown };
    accessToken = setting?.value || process.env.META_PAGE_ACCESS_TOKEN || null;
  }

  if (!accessToken) {
    logger.error("No Meta access token configured (OAuth or legacy)");
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`,
      {},
      10000 // 10 seconds for Facebook API
    );

    if (!response.ok) {
      logger.error("Facebook API error", { status: response.status });
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.exception("Error fetching lead from Facebook", error, { leadgenId });
    return null;
  }
}

function extractLeadFields(fields: Array<{ name: string; values: string[] }>) {
  const result: Record<string, string> = {};

  for (const field of fields) {
    const value = field.values?.[0] || "";
    const name = field.name.toLowerCase();

    if (name.includes("phone") || name === "phone_number") {
      result.phone = value;
    } else if (name.includes("email") || name === "email") {
      result.email = value;
    } else if (name === "first_name") {
      result.firstName = value;
    } else if (name === "last_name") {
      result.lastName = value;
    } else if (name === "full_name") {
      result.fullName = value;
    } else if (name.includes("propósito") || name.includes("proposito") || name.includes("purpose")) {
      // Custom question (example: "¿Cuál es el propósito de tu compra?")
      result.purpose = value;
    } else if (name === "dni" || name.includes("dni")) {
      // SECURITY: Encrypt DNI before storing - REQUIRED
      // Stored only in lead_sources.form_data, never in leads table
      if (!isPIIEncryptionEnabled()) {
        // P0 FIX: Block processing if DNI present without encryption
        logger.security("PII_ENCRYPTION_KEY not configured - DNI field rejected");
        Alerts.piiEncryptionMissing("dni");
        // Skip DNI field instead of storing unencrypted
        continue;
      }
      result.dni = encryptPII(value);
    }
  }

  // Construct full name if not provided
  if (!result.fullName && (result.firstName || result.lastName)) {
    result.fullName = [result.firstName, result.lastName].filter(Boolean).join(" ");
  }

  return result;
}

