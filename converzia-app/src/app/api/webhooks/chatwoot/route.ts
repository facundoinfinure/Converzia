import { NextRequest, NextResponse } from "next/server";
import { processIncomingMessage, handleMessageStatusUpdate } from "@/lib/services/conversation";
import { sendMessageWithRetry } from "@/lib/services/chatwoot";
import { validateChatwootSignature } from "@/lib/security/webhook-validation";
import { withRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/security/rate-limit";
import { logger, Metrics, Alerts, generateTraceId, setTraceId } from "@/lib/monitoring";

// ============================================
// Chatwoot Webhook Handler
// ============================================

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
    
    // SECURITY: Signature validation is REQUIRED
    const signature = request.headers.get("x-chatwoot-signature");
    const webhookSecret = process.env.CHATWOOT_WEBHOOK_SECRET;
    
    // P0 FIX: Block requests without proper signature validation
    if (!webhookSecret) {
      logger.security("CHATWOOT_WEBHOOK_SECRET not configured - webhook rejected");
      Alerts.webhookSignatureInvalid("chatwoot", getClientIdentifier(request));
      return NextResponse.json(
        { error: "Server configuration error: webhook secret not configured" },
        { status: 500 }
      );
    }
    
    if (!signature) {
      logger.security("Chatwoot webhook received without signature", {
        ip: getClientIdentifier(request).substring(0, 8) + "...",
      });
      Metrics.webhookReceived("chatwoot", "error");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    
    const isValid = validateChatwootSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      logger.security("Invalid Chatwoot webhook signature", {
        ip: getClientIdentifier(request).substring(0, 8) + "...",
      });
      Alerts.webhookSignatureInvalid("chatwoot", getClientIdentifier(request));
      Metrics.webhookReceived("chatwoot", "error");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      Metrics.webhookReceived("chatwoot", "error");
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Validate webhook payload structure
    if (!payload.event) {
      Metrics.webhookReceived("chatwoot", "error");
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    // Log event type (without sensitive data)
    logger.webhook("chatwoot", { event: payload.event, messageType: payload.message_type || "" });

    // Handle message status updates (delivered, read, failed)
    if (payload.event === "message_updated") {
      const messageId = payload.id;
      const status = payload.status; // 'sent', 'delivered', 'read', 'failed'
      
      if (messageId && status) {
        await handleMessageStatusUpdate(String(messageId), status);
      }
      
      Metrics.webhookReceived("chatwoot", "success");
      return NextResponse.json({ status: "status_processed" });
    }

    // Only process incoming messages from contacts
    if (
      payload.event !== "message_created" ||
      payload.message_type !== "incoming" ||
      payload.sender?.type !== "contact"
    ) {
      Metrics.webhookReceived("chatwoot", "ignored");
      return NextResponse.json({ status: "ignored" });
    }

    const conversationId = payload.conversation?.id;
    const message = payload.content;
    const senderPhone = payload.sender?.phone_number || payload.conversation?.meta?.sender?.phone_number;

    if (!conversationId || !message || !senderPhone) {
      logger.info("Chatwoot webhook missing required fields", { 
        hasConversationId: !!conversationId, 
        hasMessage: !!message, 
        hasPhone: !!senderPhone 
      });
      Metrics.webhookReceived("chatwoot", "ignored");
      return NextResponse.json({ status: "ignored" });
    }

    Metrics.messageReceived();

    // Process the message and generate response
    const response = await processIncomingMessage(
      String(conversationId),
      message,
      senderPhone
    );

    // Send response via Chatwoot with retry
    if (response) {
      try {
        await sendMessageWithRetry(String(conversationId), response);
        Metrics.messageSent("success");
      } catch (err) {
        logger.exception("Failed to send message after retries", err, { conversationId });
        Alerts.chatwootSendFailed(String(conversationId), err instanceof Error ? err.message : "Unknown");
        Metrics.messageSent("error");
      }
    }

    Metrics.webhookReceived("chatwoot", "success");
    return NextResponse.json({
      success: true,
      response_sent: !!response,
    });
  } catch (error) {
    logger.exception("Chatwoot webhook error", error);
    Metrics.webhookReceived("chatwoot", "error");
    Metrics.errorOccurred("webhook", "chatwoot");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Chatwoot may send GET requests to verify the webhook
export async function GET() {
  return NextResponse.json({ status: "ok", service: "chatwoot-webhook" });
}

