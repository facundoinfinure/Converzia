import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout, rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import { unsafeRpc } from "@/lib/supabase/unsafe-rpc";
import { withRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/security/rate-limit";
import Stripe from "stripe";
import { logger } from "@/lib/utils/logger";
import { logCreditPurchase } from "@/lib/monitoring/audit";
import type { CreditLedgerEntry } from "@/types/supabase-helpers";

// ============================================
// Stripe Webhook Handler
// ============================================

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia" as any,
  });
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.webhook);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Validate required configuration
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    logger.error("SECURITY: STRIPE_WEBHOOK_SECRET not configured - webhook rejected");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    logger.error("SECURITY: Stripe webhook missing signature", {
      ip: getClientIdentifier(request).substring(0, 8) + "...",
    });
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    logger.error("SECURITY: Stripe webhook signature verification failed", err, {
      ip: getClientIdentifier(request).substring(0, 8) + "...",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (!metadata?.tenant_id || !metadata?.credits || !metadata?.billing_order_id) {
        logger.error("Missing metadata in checkout session", { sessionId: session.id, metadata });
        break;
      }

      const tenantId = metadata.tenant_id;
      const credits = parseInt(metadata.credits);
      const billingOrderId = metadata.billing_order_id;

      // Idempotency: if order already completed, do nothing
      interface BillingOrder {
        id: string;
        status: string;
      }
      
      const { data: existingOrder } = await queryWithTimeout(
        supabase
          .from("billing_orders")
          .select("id, status")
          .eq("id", billingOrderId)
          .maybeSingle(),
        10000,
        "check existing billing order"
      ) as { data: BillingOrder | null; error: unknown };

      if (!existingOrder) {
        logger.error("Billing order not found for session", { sessionId: session.id, billingOrderId });
        break;
      }

      if (existingOrder.status === "completed") {
        logger.info("Stripe webhook already processed", { sessionId: session.id, billingOrderId });
        break;
      }

      // Mark order completed
      await queryWithTimeout(
        supabase
          .from("billing_orders")
          .update({
            status: "completed",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_checkout_session_id: session.id,
          })
          .eq("id", billingOrderId),
        10000,
        "mark billing order completed"
      );

      // Add credits atomically (ledger trigger calculates balance_after)
      const rpcResult = await rpcWithTimeout<unknown>(
        unsafeRpc<unknown>(supabase, "add_credits", {
          p_tenant_id: tenantId,
          p_amount: credits,
          p_billing_order_id: billingOrderId,
          p_description: `Compra de ${credits} créditos`,
        }),
        10000,
        "add_credits",
        false
      );
      const addError = rpcResult.error;

      if (addError) {
        logger.error("Error adding credits", addError, { tenantId, credits, billingOrderId });
        break;
      }

      logger.info(`Credits added: ${credits} to tenant ${tenantId}`, { tenantId, credits, billingOrderId });
      
      // Log audit event (user_id from metadata, or null for system-initiated)
      const userId = metadata.user_id || null;
      const packageId = metadata.package_id || undefined;
      if (userId) {
        await logCreditPurchase(
          userId,
          tenantId,
          billingOrderId,
          credits, // Using credits as amount since price is not directly available
          credits,
          packageId,
          request
        );
      }
      
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      logger.warn("Payment failed", { paymentIntentId: paymentIntent.id });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      // Handle subscription events if we add subscription billing
      const subscription = event.data.object as Stripe.Subscription;
      logger.info("Subscription event", { subscriptionId: subscription.id, eventType: event.type });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
