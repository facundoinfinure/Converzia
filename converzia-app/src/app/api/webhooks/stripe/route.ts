import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import Stripe from "stripe";

// ============================================
// Stripe Webhook Handler
// ============================================

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-02-24.acacia" as any,
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (!metadata?.tenant_id || !metadata?.credits || !metadata?.billing_order_id) {
        console.error("Missing metadata in checkout session");
        break;
      }

      const tenantId = metadata.tenant_id;
      const credits = parseInt(metadata.credits);
      const billingOrderId = metadata.billing_order_id;

      // Idempotency: if order already completed, do nothing
      const { data: existingOrder } = await queryWithTimeout(
        (supabase as any)
          .from("billing_orders")
          .select("id, status")
          .eq("id", billingOrderId)
          .maybeSingle(),
        10000,
        "check existing billing order"
      );

      if (!existingOrder) {
        console.error("Billing order not found for session:", session.id);
        break;
      }

      if (existingOrder.status === "completed") {
        console.log("Stripe webhook already processed:", session.id);
        break;
      }

      // Mark order completed
      await queryWithTimeout(
        (supabase as any)
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
      // RPC calls need manual timeout
      const rpcTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: La operación RPC tardó más de 10 segundos")), 10000);
      });

      const { error: addError } = await Promise.race([
        (supabase as any).rpc("add_credits", {
          p_tenant_id: tenantId,
          p_amount: credits,
          p_billing_order_id: billingOrderId,
          p_description: `Compra de ${credits} créditos`,
        }),
        rpcTimeoutPromise,
      ]) as any;

      if (addError) {
        console.error("Error adding credits:", addError);
        break;
      }

      console.log(`Credits added: ${credits} to tenant ${tenantId} (order ${billingOrderId})`);
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log("Payment failed:", paymentIntent.id);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      // Handle subscription events if we add subscription billing
      const subscription = event.data.object as Stripe.Subscription;
      console.log("Subscription event:", subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

