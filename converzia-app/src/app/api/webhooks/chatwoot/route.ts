import { NextRequest, NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/services/conversation";
import { sendMessage } from "@/lib/services/chatwoot";
import { validateChatwootSignature } from "@/lib/security/webhook-validation";
import { withRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/security/rate-limit";

// ============================================
// Chatwoot Webhook Handler
// ============================================

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.webhook);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Validate webhook signature if configured
    // Note: Some Chatwoot installations don't send signatures
    const signature = request.headers.get("x-chatwoot-signature");
    const webhookSecret = process.env.CHATWOOT_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      // Both secret and signature present - validate
      const isValid = validateChatwootSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error("SECURITY: Invalid Chatwoot webhook signature", {
          ip: getClientIdentifier(request).substring(0, 8) + "...",
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (webhookSecret && !signature) {
      // Secret configured but no signature received - Chatwoot might not support it
      console.warn("SECURITY: Chatwoot webhook received without signature - proceeding with caution");
    } else if (!webhookSecret) {
      // No secret configured - log warning
      console.warn("SECURITY: CHATWOOT_WEBHOOK_SECRET not configured - signature validation skipped");
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Validate webhook payload structure
    if (!payload.event) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    // Log event type (without sensitive data)
    console.log("Chatwoot webhook event:", payload.event, payload.message_type || "");

    // Only process incoming messages from contacts
    if (
      payload.event !== "message_created" ||
      payload.message_type !== "incoming" ||
      payload.sender?.type !== "contact"
    ) {
      return NextResponse.json({ status: "ignored" });
    }

    const conversationId = payload.conversation?.id;
    const message = payload.content;
    const senderPhone = payload.sender?.phone_number || payload.conversation?.meta?.sender?.phone_number;

    if (!conversationId || !message || !senderPhone) {
      console.log("Missing required fields:", { 
        hasConversationId: !!conversationId, 
        hasMessage: !!message, 
        hasPhone: !!senderPhone 
      });
      return NextResponse.json({ status: "ignored" });
    }

    // Process the message and generate response
    const response = await processIncomingMessage(
      String(conversationId),
      message,
      senderPhone
    );

    // Send response via Chatwoot if one was generated
    if (response) {
      await sendMessage(String(conversationId), response);
    }

    return NextResponse.json({
      success: true,
      response_sent: !!response,
    });
  } catch (error) {
    console.error("Chatwoot webhook error:", error instanceof Error ? error.message : "Unknown error");
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

