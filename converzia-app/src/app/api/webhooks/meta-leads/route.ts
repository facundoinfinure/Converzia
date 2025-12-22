import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { startInitialConversation } from "@/lib/services/conversation";
import { validateMetaSignature } from "@/lib/security/webhook-validation";
import { withRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/security/rate-limit";
import { encryptPII, isPIIEncryptionEnabled } from "@/lib/security/crypto";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { normalizePhone } from "@/lib/utils";

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
    console.error("META_WEBHOOK_VERIFY_TOKEN not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Meta webhook verified successfully");
    return new Response(challenge, { status: 200 });
  }

  console.warn("Meta webhook verification failed", { mode, tokenMatch: token === verifyToken });
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Handle incoming leads
export async function POST(request: NextRequest) {
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
      console.error("SECURITY: META_APP_SECRET not configured - webhook rejected");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    
    const isValid = validateMetaSignature(rawBody, signature, appSecret);
    if (!isValid) {
      console.error("SECURITY: Invalid Meta webhook signature", {
        ip: getClientIdentifier(request).substring(0, 8) + "...",
        hasSignature: !!signature,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Validate Facebook webhook payload
    if (payload.object !== "page" && payload.object !== "instagram") {
      return NextResponse.json({ status: "ignored" });
    }

    console.log("Meta webhook received:", payload.object, "entries:", payload.entry?.length || 0);

    const supabase = createAdminClient();

    // Process each entry
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;

        const leadgenData = change.value;
        const adId = leadgenData.ad_id;
        const formId = leadgenData.form_id;
        const leadgenId = leadgenData.leadgen_id;
        const createdTime = new Date(leadgenData.created_time * 1000);

        if (!adId || !leadgenId) {
          console.warn("Meta leadgen change missing ad_id or leadgen_id");
          continue;
        }

        // Resolve tenant/offer by ad_id (ad_id is unique per tenant in this product)
        const { data: adMapping } = await (supabase as any)
          .from("ad_offer_map")
          .select("tenant_id, offer_id")
          .eq("ad_id", adId)
          .eq("is_active", true)
          .maybeSingle();

        if (!adMapping?.tenant_id) {
          console.warn("Unknown ad_id (no tenant mapping). Ignoring lead.", { adId });
          continue;
        }

        // Fetch lead details from Facebook Graph API
        const leadData = await fetchLeadDetails(leadgenId);

        if (!leadData) {
          console.error("Could not fetch lead details for:", leadgenId);
          continue;
        }

        // Extract fields from lead data
        const fields = leadData.field_data || [];
        const extractedData = extractLeadFields(fields);

        // Normalize phone number
        const phoneE164 = normalizePhone(extractedData.phone || "");

        if (!phoneE164) {
          console.error("Lead has no valid phone:", leadgenId);
          continue;
        }

        // Upsert lead
        const { data: lead, error: leadError } = await (supabase as any)
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
          .single();

        if (leadError || !lead) {
          console.error("Error upserting lead:", leadError);
          continue;
        }

        // Idempotency: if we've already processed this leadgen_id for this tenant, ignore
        const { data: existingSource } = await (supabase as any)
          .from("lead_sources")
          .select("id")
          .eq("tenant_id", adMapping.tenant_id)
          .eq("leadgen_id", leadgenId)
          .maybeSingle();

        const leadSourceId =
          existingSource?.id ||
          (
            await (supabase as any)
              .from("lead_sources")
              .insert({
                lead_id: lead.id,
                tenant_id: adMapping.tenant_id,
                platform: "META",
                ad_id: adId,
                campaign_id: leadgenData.campaign_id || null,
                adset_id: leadgenData.adset_id || null,
                form_id: formId || null,
                leadgen_id: leadgenId,
                form_data: {
                  leadgen: leadgenData,
                  lead: leadData,
                  received_at: new Date().toISOString(),
                },
              })
              .select("id")
              .single()
          ).data?.id;

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

        let leadOffer: any = null;

        if (offerId) {
          const res = await (supabase as any)
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
            .select()
            .single();
          leadOffer = res.data;
        } else {
          // For unmapped ads we still create a tenant-scoped lead_offer (offer_id null)
          const { data: existingPending } = await (supabase as any)
            .from("lead_offers")
            .select("id")
            .eq("lead_id", lead.id)
            .eq("tenant_id", adMapping.tenant_id)
            .is("offer_id", null)
            .eq("status", "PENDING_MAPPING")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingPending?.id) {
            leadOffer = { id: existingPending.id };
          } else {
            const res = await (supabase as any)
              .from("lead_offers")
              .insert({
                lead_id: lead.id,
                tenant_id: adMapping.tenant_id,
                offer_id: null,
                lead_source_id: leadSourceId || null,
                status,
                qualification_fields: prefillQualification,
              })
              .select()
              .single();
            leadOffer = res.data;
          }
        }

        // Log event
        await (supabase as any).from("lead_events").insert({
          lead_id: lead.id,
          lead_offer_id: leadOffer?.id,
          tenant_id: adMapping.tenant_id,
          event_type: "CREATED",
          details: {
            source: "META_LEAD_AD",
            ad_id: adId,
            form_id: formId,
            leadgen_id: leadgenId,
          },
          actor_type: "SYSTEM",
        });

        // If mapped, trigger initial conversation
        if (offerId && leadOffer?.id) {
          try {
            await startInitialConversation(leadOffer.id);
          } catch (err) {
            console.error("Error starting conversation:", err);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Meta webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

async function fetchLeadDetails(leadgenId: string): Promise<any> {
  // Get access token from settings
  const supabase = createAdminClient();
  const { data: setting } = await queryWithTimeout(
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "meta_page_access_token")
      .single(),
    10000,
    "get Meta access token",
    false // Don't retry settings
  );

  const accessToken = (setting as any)?.value || process.env.META_PAGE_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("No Meta access token configured");
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`,
      {},
      10000 // 10 seconds for Facebook API
    );

    if (!response.ok) {
      console.error("Facebook API error:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching lead from Facebook:", error);
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
      // SECURITY: Encrypt DNI before storing
      // Stored only in lead_sources.form_data, never in leads table
      if (isPIIEncryptionEnabled()) {
        result.dni = encryptPII(value);
      } else {
        // Fallback: store as-is but log warning
        console.warn("PII_ENCRYPTION_KEY not configured - DNI stored unencrypted");
        result.dni = value;
      }
    }
  }

  // Construct full name if not provided
  if (!result.fullName && (result.firstName || result.lastName)) {
    result.fullName = [result.firstName, result.lastName].filter(Boolean).join(" ");
  }

  return result;
}

