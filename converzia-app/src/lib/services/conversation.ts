import { createAdminClient } from "@/lib/supabase/server";
import { sendMessage, findOrCreateContact } from "./chatwoot";
import { extractQualificationFields, generateQualificationResponse, generateConversationSummary } from "./openai";
import { calculateLeadScore, checkMinimumFieldsForScoring } from "./scoring";
import type { LeadOffer, QualificationFields, Offer } from "@/types";
import { normalizePhoneForDb } from "@/lib/utils";

// ============================================
// Conversation Flow Service
// ============================================

interface ConversationContext {
  leadOfferId: string;
  tenantId: string;
  offerId: string | null;
  phone: string;
  currentFields: QualificationFields;
  messageHistory: Array<{ role: "user" | "assistant"; content: string }>;
  offer: Offer | null;
}

// ============================================
// Start Initial Conversation
// ============================================

export async function startInitialConversation(leadOfferId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get lead offer with related data
  const { data: leadOffer, error } = await supabase
    .from("lead_offers")
    .select(`
      *,
      lead:leads(*),
      offer:offers(*),
      tenant:tenants(*)
    `)
    .eq("id", leadOfferId)
    .single();

  if (error || !leadOffer) {
    throw new Error(`Lead offer not found: ${leadOfferId}`);
  }

  const lead = Array.isArray(leadOffer.lead) ? leadOffer.lead[0] : leadOffer.lead;
  const offer = Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer;
  const tenant = Array.isArray(leadOffer.tenant) ? leadOffer.tenant[0] : leadOffer.tenant;

  if (!lead?.phone) {
    throw new Error("Lead has no phone number");
  }

  // Find or create Chatwoot contact
  const contact = await findOrCreateContact(lead.phone, lead.full_name || undefined);
  const chatwootConversationId = String(contact.conversation_id || contact.id);

  // Ensure conversation is stored in DB (mapped to Chatwoot conversation)
  await supabase
    .from("conversations")
    .upsert(
      {
        lead_id: lead.id,
        tenant_id: leadOffer.tenant_id,
        chatwoot_conversation_id: chatwootConversationId,
        chatwoot_contact_id: String(contact.id),
        is_active: true,
      },
      { onConflict: "chatwoot_conversation_id" }
    );

  // Get initial message template
  const initialMessage = generateInitialMessage({
    leadName: lead.first_name || lead.full_name?.split(" ")[0] || "",
    offerName: offer?.name || "",
    tenantName: tenant?.name || "",
  });

  // Send message via Chatwoot
  await sendMessage(chatwootConversationId, initialMessage);

  // Update lead offer status
  await supabase
    .from("lead_offers")
    .update({
      status: "CONTACTED",
      contact_attempts: (leadOffer.contact_attempts || 0) + 1,
      last_attempt_at: new Date().toISOString(),
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", leadOfferId);

  // Log event
  await supabase.from("lead_events").insert({
    lead_id: lead.id,
    lead_offer_id: leadOfferId,
    event_type: "MESSAGE_SENT",
    details: { message: initialMessage, type: "initial" },
    actor_type: "BOT",
  });
}

// ============================================
// Process Incoming Message
// ============================================

export async function processIncomingMessage(
  conversationId: string,
  message: string,
  senderPhone: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // Find lead by phone
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("phone_normalized", normalizePhoneForDb(senderPhone))
    .single();

  if (!lead) {
    console.log("No lead found for phone:", senderPhone);
    return null;
  }

  // Get active lead offer
  const { data: leadOffer } = await supabase
    .from("lead_offers")
    .select(`
      *,
      offer:offers(*)
    `)
    .eq("lead_id", lead.id)
    .in("status", ["CONTACTED", "ENGAGED", "QUALIFYING"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!leadOffer) {
    console.log("No active lead offer for lead:", lead.id);
    return null;
  }

  const offer = Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer;

  // Store incoming message
  // Ensure we have a Converzia conversation record mapped to Chatwoot conversation ID
  const { data: convo } = await supabase
    .from("conversations")
    .select("id")
    .eq("chatwoot_conversation_id", conversationId)
    .single();

  const conversationRow =
    convo ||
    (
      await supabase
        .from("conversations")
        .insert({
          lead_id: lead.id,
          tenant_id: leadOffer.tenant_id,
          chatwoot_conversation_id: conversationId,
          is_active: true,
        })
        .select("id")
        .single()
    ).data;

  await supabase.from("messages").insert({
    conversation_id: conversationRow.id,
    lead_id: lead.id,
    direction: "INBOUND",
    sender: "LEAD",
    content: message,
  });

  // Update lead offer status to ENGAGED if still CONTACTED
  if (leadOffer.status === "CONTACTED") {
    await supabase
      .from("lead_offers")
      .update({
        status: "ENGAGED",
        first_response_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", leadOffer.id);
  }

  // Get conversation history
  const { data: history } = await supabase
    .from("messages")
    .select("direction, sender, content")
    .eq("conversation_id", conversationRow.id)
    .order("created_at", { ascending: true })
    .limit(20);

  const messageHistory = (history || []).map((m: any) => ({
    role: m.sender === "LEAD" ? "user" as const : "assistant" as const,
    content: m.content,
  }));

  // Extract qualification fields from new message
  const currentFields = (leadOffer.qualification_fields as QualificationFields) || {};
  const newFields = await extractQualificationFields(message, currentFields);
  const mergedFields = { ...currentFields, ...newFields };

  // Update qualification fields
  await supabase
    .from("lead_offers")
    .update({
      qualification_fields: mergedFields,
      status: "QUALIFYING",
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", leadOffer.id);

  // Check if we have enough information to score
  const fieldCheck = checkMinimumFieldsForScoring(mergedFields);

  if (fieldCheck.ready) {
    // Calculate score using real scoring engine
    const scoreResult = await calculateLeadScore(
      mergedFields,
      offer,
      leadOffer.tenant_id,
      { messageCount: (history?.length || 0) + 1, responseTime: 30 }
    );

    await supabase
      .from("lead_offers")
      .update({
        score_total: scoreResult.score,
        score_breakdown: scoreResult.breakdown,
        scored_at: new Date().toISOString(),
        status: scoreResult.isReady ? "LEAD_READY" : "SCORED",
        qualified_at: scoreResult.isReady ? new Date().toISOString() : null,
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", leadOffer.id);

    // If lead ready, trigger delivery
    if (scoreResult.isReady) {
      await triggerDelivery(leadOffer.id, scoreResult.explanation.summary);
    }
  }

  // Generate response
  const response = await generateQualificationResponse(
    message,
    mergedFields,
    messageHistory,
    offer
  );

  // Store outgoing message
  await supabase.from("messages").insert({
    conversation_id: conversationRow.id,
    lead_id: lead.id,
    direction: "OUTBOUND",
    sender: "BOT",
    content: response,
  });

  // Log event
  await supabase.from("lead_events").insert({
    lead_id: lead.id,
    lead_offer_id: leadOffer.id,
    event_type: "MESSAGE_RECEIVED",
    details: { message, extracted_fields: newFields },
    actor_type: "LEAD",
  });

  return response;
}

// ============================================
// Retry Contact
// ============================================

export async function retryContact(leadOfferId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: leadOffer } = await supabase
    .from("lead_offers")
    .select(`
      *,
      lead:leads(*),
      offer:offers(*),
      tenant:tenants(*)
    `)
    .eq("id", leadOfferId)
    .single();

  if (!leadOffer) {
    throw new Error("Lead offer not found");
  }

  const lead = Array.isArray(leadOffer.lead) ? leadOffer.lead[0] : leadOffer.lead;
  const offer = Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer;

  // Check max attempts
  const maxAttempts = 3;
  if ((leadOffer.contact_attempts || 0) >= maxAttempts) {
    await supabase
      .from("lead_offers")
      .update({
        status: "COOLING",
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", leadOfferId);
    return;
  }

  // Send follow-up message
  const followUpMessage = generateFollowUpMessage({
    leadName: lead?.first_name || "",
    offerName: offer?.name || "",
    attemptNumber: (leadOffer.contact_attempts || 0) + 1,
  });

  const contact = await findOrCreateContact(lead.phone, lead.full_name || undefined);
  await sendMessage(contact.conversation_id || contact.id, followUpMessage);

  // Update lead offer
  await supabase
    .from("lead_offers")
    .update({
      contact_attempts: (leadOffer.contact_attempts || 0) + 1,
      last_attempt_at: new Date().toISOString(),
      next_attempt_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next day
    })
    .eq("id", leadOfferId);
}

// ============================================
// Reactivation
// ============================================

export async function sendReactivation(leadOfferId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: leadOffer } = await supabase
    .from("lead_offers")
    .select(`
      *,
      lead:leads(*),
      offer:offers(*),
      tenant:tenants(*)
    `)
    .eq("id", leadOfferId)
    .single();

  if (!leadOffer) {
    throw new Error("Lead offer not found");
  }

  const lead = Array.isArray(leadOffer.lead) ? leadOffer.lead[0] : leadOffer.lead;
  const offer = Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer;
  const tenant = Array.isArray(leadOffer.tenant) ? leadOffer.tenant[0] : leadOffer.tenant;

  const reactivationMessage = generateReactivationMessage({
    leadName: lead?.first_name || "",
    offerName: offer?.name || "",
    tenantName: tenant?.name || "",
  });

  const contact = await findOrCreateContact(lead.phone, lead.full_name || undefined);
  await sendMessage(contact.conversation_id || contact.id, reactivationMessage);

  await supabase
    .from("lead_offers")
    .update({
      status: "REACTIVATION",
      reactivation_count: (leadOffer.reactivation_count || 0) + 1,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", leadOfferId);
}

// ============================================
// Trigger Delivery
// ============================================

async function triggerDelivery(leadOfferId: string, scoreSummary?: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: leadOffer } = await supabase
    .from("lead_offers")
    .select(`
      *,
      lead:leads(*),
      offer:offers(*),
      lead_source:lead_sources(*)
    `)
    .eq("id", leadOfferId)
    .single();

  if (!leadOffer) return;

  const lead = Array.isArray(leadOffer.lead) ? leadOffer.lead[0] : leadOffer.lead;
  const offer = Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer;
  const source = Array.isArray(leadOffer.lead_source) ? leadOffer.lead_source[0] : leadOffer.lead_source;

  // Get conversation history for summary
  const { data: messages } = await supabase
    .from("messages")
    .select("direction, sender, content")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true })
    .limit(50);

  // Generate conversation summary
  let conversationSummary = null;
  if (messages && messages.length > 0) {
    try {
      conversationSummary = await generateConversationSummary(
        messages.map((m: any) => ({
          role: m.sender === "LEAD" ? "user" as const : "assistant" as const,
          content: m.content,
        }))
      );
    } catch (error) {
      console.error("Error generating conversation summary:", error);
      conversationSummary = `Conversación con ${messages.length} mensajes.`;
    }
  }

  // Create delivery record with complete data
  await supabase.from("deliveries").insert({
    lead_offer_id: leadOfferId,
    lead_id: lead.id,
    tenant_id: leadOffer.tenant_id,
    offer_id: offer?.id,
    status: "PENDING",
    payload: {
      lead: {
        name: lead.full_name || lead.first_name || "Sin nombre",
        phone: lead.phone,
        email: lead.email,
      },
      qualification: leadOffer.qualification_fields,
      score: {
        total: leadOffer.score_total,
        breakdown: leadOffer.score_breakdown,
        explanation: scoreSummary,
      },
      recommended_offer: offer ? { id: offer.id, name: offer.name } : null,
      alternatives: leadOffer.alternative_offers || [],
      conversation_summary: conversationSummary,
      source: source ? {
        platform: source.platform,
        ad_id: source.ad_id,
        campaign_id: source.campaign_id,
        form_id: source.form_id,
      } : null,
    },
  });

  // Log delivery event
  await supabase.from("lead_events").insert({
    lead_id: lead.id,
    lead_offer_id: leadOfferId,
    tenant_id: leadOffer.tenant_id,
    event_type: "DELIVERY_ATTEMPTED",
    details: {
      score: leadOffer.score_total,
      offer_name: offer?.name,
    },
    actor_type: "SYSTEM",
  });

  console.log(`Delivery created for lead ${lead.id}, score: ${leadOffer.score_total}`);
}

// ============================================
// Helper Functions
// ============================================

function generateInitialMessage(data: {
  leadName: string;
  offerName: string;
  tenantName: string;
}): string {
  const greeting = data.leadName ? `Hola ${data.leadName}` : "Hola";

  return `${greeting}, soy el asistente virtual de ${data.tenantName}. Vi que te interesó ${data.offerName || "nuestros proyectos"}. ¿En qué puedo ayudarte? 🏠`;
}

function generateFollowUpMessage(data: {
  leadName: string;
  offerName: string;
  attemptNumber: number;
}): string {
  const messages = [
    `Hola ${data.leadName || ""}, te escribo de nuevo para saber si pudiste ver la información de ${data.offerName || "nuestro proyecto"}. ¿Tenés alguna consulta?`,
    `Hola! Quería saber si seguís interesado/a en ${data.offerName || "el proyecto"}. Estoy para ayudarte con cualquier duda.`,
  ];

  return messages[Math.min(data.attemptNumber - 1, messages.length - 1)];
}

function generateReactivationMessage(data: {
  leadName: string;
  offerName: string;
  tenantName: string;
}): string {
  return `Hola ${data.leadName || ""}, soy de ${data.tenantName}. Hace un tiempo consultaste por ${data.offerName || "nuestros proyectos"}. ¿Seguís buscando? Tenemos novedades que pueden interesarte.`;
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

