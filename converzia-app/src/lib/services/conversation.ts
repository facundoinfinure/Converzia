import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { sendMessageWithRetry, sendTemplateMessage, findOrCreateContact } from "./chatwoot";
import { 
  extractQualificationFields, 
  generateQualificationResponse, 
  generateConversationSummary,
  generateRollingSummary,
  shouldGenerateRollingSummary,
  getMessagesToKeep
} from "./openai";
import { calculateLeadScore, checkMinimumFieldsForScoring } from "./scoring";
import type { LeadOffer, QualificationFields, Offer } from "@/types";
import { normalizePhoneForDb } from "@/lib/utils";
import { logger, Metrics } from "@/lib/monitoring";

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
  const { data: leadOffer, error } = await queryWithTimeout(
    supabase
      .from("lead_offers")
      .select(`
        *,
        lead:leads(*),
        offer:offers(*),
        tenant:tenants(*)
      `)
      .eq("id", leadOfferId)
      .single(),
    10000,
    `fetch lead offer ${leadOfferId}`
  );

  if (error || !leadOffer) {
    throw new Error(`Lead offer not found: ${leadOfferId}`);
  }

  const lo = leadOffer as any;
  const lead: any = Array.isArray(lo.lead) ? lo.lead[0] : lo.lead;
  const offer = Array.isArray(lo.offer) ? lo.offer[0] : lo.offer;
  const tenant = Array.isArray(lo.tenant) ? lo.tenant[0] : lo.tenant;

  if (!lead?.phone) {
    logger.error("Lead has no phone number", { leadOfferId });
    throw new Error("Lead has no phone number");
  }

  // Find or create Chatwoot contact
  const contact = await findOrCreateContact(lead.phone, lead.full_name || undefined);
  const chatwootConversationId = String(contact.conversation_id || contact.id);

  // Ensure conversation is stored in DB (mapped to Chatwoot conversation)
  await queryWithTimeout(
    supabase
      .from("conversations")
      .upsert(
        {
          lead_id: (lead as any).id,
          tenant_id: (leadOffer as any).tenant_id,
          chatwoot_conversation_id: chatwootConversationId,
          chatwoot_contact_id: String(contact.id),
          is_active: true,
        },
        { onConflict: "chatwoot_conversation_id" }
      ),
    10000,
    "upsert conversation"
  );

  // Prepare template parameters
  const leadName = lead.first_name || lead.full_name?.split(" ")[0] || "cliente";
  const offerName = offer?.name || "nuestros proyectos";
  const tenantName = tenant?.name || "nuestro equipo";

  // Send WhatsApp template message (required for initiating conversations)
  // Template: lead_bienvenida
  // Header: ¡Hola {{1}}!
  // Body: Gracias por tu interés en {{1}}. Soy el asistente virtual de {{2}}.
  try {
    await sendTemplateMessage(
      chatwootConversationId,
      "lead_bienvenida",
      {
        header: [leadName],
        body: [offerName, tenantName],
      },
      "es_AR"
    );
    Metrics.messageSent("success");
  } catch (templateError) {
    logger.warn("Template message failed, trying regular message", { error: templateError });
    // Fallback to regular message (only works if user messaged first)
    const initialMessage = generateInitialMessage({
      leadName,
      offerName,
      tenantName,
    });
    await sendMessageWithRetry(chatwootConversationId, initialMessage);
  }
  
  const initialMessage = `[Template: lead_bienvenida] Hola ${leadName}, gracias por tu interés en ${offerName}.`;

  // Update lead offer status
  await queryWithTimeout(
    supabase
      .from("lead_offers")
      .update({
        status: "CONTACTED",
        contact_attempts: ((leadOffer as any).contact_attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", leadOfferId),
    10000,
    "update lead offer status"
  );

  // Log event
  await queryWithTimeout(
    supabase.from("lead_events").insert({
      lead_id: (lead as any).id,
      lead_offer_id: leadOfferId,
      event_type: "MESSAGE_SENT",
      details: { message: initialMessage, type: "initial" },
      actor_type: "BOT",
    }),
    10000,
    "insert lead event"
  );
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
  const { data: lead } = await queryWithTimeout(
    supabase
      .from("leads")
      .select("id")
      .eq("phone_normalized", normalizePhoneForDb(senderPhone))
      .single(),
    10000,
    "find lead by phone"
  );

  if (!lead) {
    logger.info("No lead found for phone", { phone: senderPhone.substring(0, 6) + "..." });
    return null;
  }

  // Get active lead offer
  const { data: leadOffer } = await queryWithTimeout(
    supabase
      .from("lead_offers")
      .select(`
        *,
        offer:offers(*)
      `)
      .eq("lead_id", (lead as any).id)
      .in("status", ["CONTACTED", "ENGAGED", "QUALIFYING"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    10000,
    "get active lead offer"
  );

  if (!leadOffer) {
    logger.info("No active lead offer for lead", { leadId: (lead as any).id });
    return null;
  }

  logger.conversation("message_received", (leadOffer as any).id);

  const offer = Array.isArray((leadOffer as any).offer) ? (leadOffer as any).offer[0] : (leadOffer as any).offer;

  // Store incoming message
  // Ensure we have a Converzia conversation record mapped to Chatwoot conversation ID
  const { data: convo } = await queryWithTimeout(
    supabase
      .from("conversations")
      .select("id")
      .eq("chatwoot_conversation_id", conversationId)
      .single(),
    10000,
    "find conversation"
  );

  let conversationRow = convo;
  if (!conversationRow) {
    const { data: newConvo } = await queryWithTimeout(
      supabase
        .from("conversations")
        .insert({
          lead_id: (lead as any).id,
          tenant_id: (leadOffer as any).tenant_id,
          chatwoot_conversation_id: conversationId,
          is_active: true,
        })
        .select("id")
        .single(),
      10000,
      "create conversation"
    );
    conversationRow = newConvo;
  }

  if (!conversationRow) {
    throw new Error("Failed to get or create conversation");
  }

  await queryWithTimeout(
    supabase.from("messages").insert({
      conversation_id: (conversationRow as any).id,
      lead_id: (lead as any).id,
      direction: "INBOUND",
      sender: "LEAD",
      content: message,
    }),
    10000,
    "insert message"
  );

  // Update lead offer status to ENGAGED if still CONTACTED
  if ((leadOffer as any).status === "CONTACTED") {
    await queryWithTimeout(
      supabase
        .from("lead_offers")
        .update({
          status: "ENGAGED",
          first_response_at: new Date().toISOString(),
          status_changed_at: new Date().toISOString(),
        })
        .eq("id", (leadOffer as any).id),
      10000,
      "update lead offer to ENGAGED"
    );
  }

  // Get conversation history with count for rolling summary
  const { data: history, count: messageCount } = await queryWithTimeout(
    supabase
      .from("messages")
      .select("direction, sender, content", { count: "exact" })
      .eq("conversation_id", (conversationRow as any).id)
      .order("created_at", { ascending: true }),
    10000,
    "get conversation history"
  );

  const allMessages = ((history as any[] || []) as any[]).map((m: any) => ({
    role: m.sender === "LEAD" ? "user" as const : "assistant" as const,
    content: m.content,
  }));

  // Use rolling summary for long conversations
  let messageHistory = allMessages;
  let conversationSummaryContext: string | null = null;

  if (shouldGenerateRollingSummary(messageCount || 0)) {
    // Get existing summary from conversation record
    const { data: convoData } = await queryWithTimeout(
      supabase
        .from("conversations")
        .select("summary")
        .eq("id", (conversationRow as any).id)
        .single(),
      5000,
      "get conversation summary"
    );

    const existingSummary = (convoData as any)?.summary || null;
    
    // Keep only last N messages, summarize the rest
    const messagesToSummarize = allMessages.slice(0, -getMessagesToKeep());
    messageHistory = allMessages.slice(-getMessagesToKeep());

    if (messagesToSummarize.length > 0) {
      // Update rolling summary
      conversationSummaryContext = await generateRollingSummary(existingSummary, messagesToSummarize);
      
      // Store updated summary
      await queryWithTimeout(
        supabase
          .from("conversations")
          .update({ summary: conversationSummaryContext })
          .eq("id", (conversationRow as any).id),
        5000,
        "update conversation summary"
      );
    }
  }

  // Extract qualification fields from new message
  const currentFields = ((leadOffer as any).qualification_fields as QualificationFields) || {};
  const newFields = await extractQualificationFields(message, currentFields);
  const mergedFields = { ...currentFields, ...newFields };

  // Update qualification fields
  await queryWithTimeout(
    supabase
      .from("lead_offers")
      .update({
        qualification_fields: mergedFields,
        status: "QUALIFYING",
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", (leadOffer as any).id),
    10000,
    "update qualification fields"
  );

  // Check if we have enough information to score
  const fieldCheck = checkMinimumFieldsForScoring(mergedFields);

  if (fieldCheck.ready) {
    // Calculate score using real scoring engine
    const scoreResult = await calculateLeadScore(
      mergedFields,
      offer,
      (leadOffer as any).tenant_id,
      { messageCount: (history?.length || 0) + 1, responseTime: 30 }
    );

    await queryWithTimeout(
      supabase
        .from("lead_offers")
        .update({
          score_total: scoreResult.score,
          score_breakdown: scoreResult.breakdown,
          scored_at: new Date().toISOString(),
          status: scoreResult.isReady ? "LEAD_READY" : "SCORED",
          qualified_at: scoreResult.isReady ? new Date().toISOString() : null,
          status_changed_at: new Date().toISOString(),
        })
        .eq("id", (leadOffer as any).id),
      10000,
      "update lead offer score"
    );

    // If lead ready, trigger delivery
    if (scoreResult.isReady) {
      await triggerDelivery((leadOffer as any).id, scoreResult.explanation.summary);
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
  await queryWithTimeout(
    supabase.from("messages").insert({
      conversation_id: (conversationRow as any).id,
      lead_id: (lead as any).id,
      direction: "OUTBOUND",
      sender: "BOT",
      content: response,
    }),
    10000,
    "insert outbound message"
  );

  // Log event
  await queryWithTimeout(
    supabase.from("lead_events").insert({
      lead_id: (lead as any).id,
      lead_offer_id: (leadOffer as any).id,
      event_type: "MESSAGE_RECEIVED",
      details: { message, extracted_fields: newFields },
      actor_type: "LEAD",
    }),
    10000,
    "insert lead event MESSAGE_RECEIVED"
  );

  return response;
}

// ============================================
// Retry Contact
// ============================================

export async function retryContact(leadOfferId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: leadOffer } = await queryWithTimeout(
    supabase
      .from("lead_offers")
      .select(`
        *,
        lead:leads(*),
        offer:offers(*),
        tenant:tenants(*)
      `)
      .eq("id", leadOfferId)
      .single(),
    10000,
    `fetch lead offer ${leadOfferId} for retry`
  );

  if (!leadOffer) {
    throw new Error("Lead offer not found");
  }

  const lead: any = Array.isArray((leadOffer as any).lead) ? (leadOffer as any).lead[0] : (leadOffer as any).lead;
  const offer = Array.isArray((leadOffer as any).offer) ? (leadOffer as any).offer[0] : (leadOffer as any).offer;

  // Check max attempts
  const maxAttempts = 3;
  if (((leadOffer as any).contact_attempts || 0) >= maxAttempts) {
    await queryWithTimeout(
      supabase
        .from("lead_offers")
        .update({
          status: "COOLING",
          status_changed_at: new Date().toISOString(),
        })
        .eq("id", leadOfferId),
      10000,
      "update lead offer to COOLING"
    );
    return;
  }

  // Send follow-up message
  const followUpMessage = generateFollowUpMessage({
    leadName: lead?.first_name || "",
    offerName: offer?.name || "",
    attemptNumber: ((leadOffer as any).contact_attempts || 0) + 1,
  });

  const contact = await findOrCreateContact(lead.phone, lead.full_name || undefined);
  await sendMessageWithRetry(contact.conversation_id || contact.id, followUpMessage);

  // Update lead offer
  await queryWithTimeout(
    supabase
      .from("lead_offers")
      .update({
        contact_attempts: ((leadOffer as any).contact_attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        next_attempt_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next day
      })
      .eq("id", leadOfferId),
    10000,
    "update lead offer retry"
  );
}

// ============================================
// Reactivation
// ============================================

export async function sendReactivation(leadOfferId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: leadOffer } = await queryWithTimeout(
    supabase
      .from("lead_offers")
      .select(`
        *,
        lead:leads(*),
        offer:offers(*),
        tenant:tenants(*)
      `)
      .eq("id", leadOfferId)
      .single(),
    10000,
    `fetch lead offer ${leadOfferId} for reactivation`
  );

  if (!leadOffer) {
    throw new Error("Lead offer not found");
  }

  const lead: any = Array.isArray((leadOffer as any).lead) ? (leadOffer as any).lead[0] : (leadOffer as any).lead;
  const offer = Array.isArray((leadOffer as any).offer) ? (leadOffer as any).offer[0] : (leadOffer as any).offer;
  const tenant = Array.isArray((leadOffer as any).tenant) ? (leadOffer as any).tenant[0] : (leadOffer as any).tenant;

  const reactivationMessage = generateReactivationMessage({
    leadName: lead?.first_name || "",
    offerName: offer?.name || "",
    tenantName: tenant?.name || "",
  });

  const contact = await findOrCreateContact(lead.phone, lead.full_name || undefined);
  await sendMessageWithRetry(contact.conversation_id || contact.id, reactivationMessage);

  await queryWithTimeout(
    supabase
      .from("lead_offers")
      .update({
        status: "REACTIVATION",
        reactivation_count: ((leadOffer as any).reactivation_count || 0) + 1,
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", leadOfferId),
    10000,
    "update lead offer reactivation"
  );
}

// ============================================
// Trigger Delivery
// ============================================

async function triggerDelivery(leadOfferId: string, scoreSummary?: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: leadOffer } = await queryWithTimeout(
    supabase
      .from("lead_offers")
      .select(`
        *,
        lead:leads(*),
        offer:offers(*),
        lead_source:lead_sources(*)
      `)
      .eq("id", leadOfferId)
      .single(),
    10000,
    `fetch lead offer ${leadOfferId} for delivery`
  );

  if (!leadOffer) return;

  const lead: any = Array.isArray((leadOffer as any).lead) ? (leadOffer as any).lead[0] : (leadOffer as any).lead;
  const offer = Array.isArray((leadOffer as any).offer) ? (leadOffer as any).offer[0] : (leadOffer as any).offer;
  const source = Array.isArray((leadOffer as any).lead_source) ? (leadOffer as any).lead_source[0] : (leadOffer as any).lead_source;

  // Get conversation history for summary
  const { data: messages } = await queryWithTimeout(
    supabase
      .from("messages")
      .select("direction, sender, content")
      .eq("lead_id", (lead as any).id)
      .order("created_at", { ascending: true })
      .limit(50),
    10000,
    "get messages for delivery summary"
  );

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
  await queryWithTimeout(
    supabase.from("deliveries").insert({
      lead_offer_id: leadOfferId,
      lead_id: (lead as any).id,
      tenant_id: (leadOffer as any).tenant_id,
      offer_id: offer?.id,
      status: "PENDING",
      payload: {
      lead: {
        name: lead.full_name || lead.first_name || "Sin nombre",
        phone: lead.phone,
        email: lead.email,
      },
      qualification: (leadOffer as any).qualification_fields,
      score: {
        total: (leadOffer as any).score_total,
        breakdown: (leadOffer as any).score_breakdown,
        explanation: scoreSummary,
      },
      recommended_offer: offer ? { id: offer.id, name: offer.name } : null,
      alternatives: (leadOffer as any).alternative_offers || [],
      conversation_summary: conversationSummary,
      source: source ? {
        platform: source.platform,
        ad_id: source.ad_id,
        campaign_id: source.campaign_id,
        form_id: source.form_id,
      } : null,
      },
    }),
    30000,
    "create delivery record"
  );

  // Log delivery event
  await queryWithTimeout(
    supabase.from("lead_events").insert({
      lead_id: (lead as any).id,
      lead_offer_id: leadOfferId,
      tenant_id: (leadOffer as any).tenant_id,
      event_type: "DELIVERY_ATTEMPTED",
      details: {
        score: (leadOffer as any).score_total,
        offer_name: offer?.name,
      },
      actor_type: "SYSTEM",
    }),
    10000,
    "insert delivery event"
  );

  logger.delivery("created", "pending", { 
    leadId: (lead as any).id, 
    score: (leadOffer as any).score_total 
  });
}

// ============================================
// Handle Message Status Updates
// ============================================

export async function handleMessageStatusUpdate(
  chatwootMessageId: string,
  status: string
): Promise<void> {
  const supabase = createAdminClient();

  // Map Chatwoot status to our fields
  const updateData: Record<string, unknown> = {};
  
  switch (status) {
    case "delivered":
      updateData.delivered_at = new Date().toISOString();
      break;
    case "read":
      updateData.read_at = new Date().toISOString();
      break;
    case "failed":
      updateData.failed_at = new Date().toISOString();
      logger.error("Message delivery failed", { chatwootMessageId });
      break;
    default:
      // Ignore other statuses
      return;
  }

  if (Object.keys(updateData).length > 0) {
    await queryWithTimeout(
      supabase
        .from("messages")
        .update(updateData)
        .eq("chatwoot_message_id", chatwootMessageId),
      5000,
      "update message status"
    );
    
    logger.info("Message status updated", { chatwootMessageId, status });
  }
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

