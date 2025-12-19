import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import Stripe from "stripe";

// ============================================
// Billing Checkout - Create Stripe Session
// ============================================

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-02-24.acacia" as any,
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_id, package_id, credits, price } = body;

    if (!tenant_id || !credits || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user has billing access to this tenant
    const { data: membership } = await queryWithTimeout(
      supabase
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .single(),
      10000,
      "check billing access"
    );

    if (!membership || !["OWNER", "ADMIN", "BILLING"].includes((membership as any).role)) {
      return NextResponse.json({ error: "No billing access" }, { status: 403 });
    }

    // Get tenant details
    const { data: tenant } = await queryWithTimeout(
      supabase
        .from("tenants")
        .select("id, name")
        .eq("id", tenant_id)
        .single(),
      10000,
      "get tenant details"
    );

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Create or get Stripe customer (stored in stripe_customers table)
    let customerId: string | null = null;

    const { data: existingCustomer } = await queryWithTimeout(
      (admin as any)
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("tenant_id", tenant_id)
        .maybeSingle(),
      10000,
      "get existing Stripe customer"
    );

    if (existingCustomer?.stripe_customer_id) {
      customerId = existingCustomer.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        name: (tenant as any).name,
        metadata: { tenant_id },
      });

      customerId = customer.id;

      await queryWithTimeout(
        (admin as any).from("stripe_customers").insert({
          tenant_id,
          stripe_customer_id: customerId,
          billing_email: user.email,
          billing_name: (tenant as any).name,
          metadata: { created_by_user_id: user.id },
        }),
        10000,
        "create Stripe customer"
      );
    }

    // Create billing order (pending)
    const { data: billingOrder, error: orderError } = await queryWithTimeout(
      (supabase as any)
        .from("billing_orders")
        .insert({
          tenant_id,
          package_name: package_id || "custom",
          credits_purchased: credits,
          subtotal: price,
          discount_amount: 0,
          tax_amount: 0,
          total: price,
          currency: "USD",
          status: "pending",
        })
        .select("id, order_number")
        .single(),
      30000,
      "create billing order"
    );

    if (orderError || !billingOrder) {
      return NextResponse.json({ error: "Failed to create billing order" }, { status: 500 });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId!,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${credits} Créditos Converzia`,
              description: `Paquete de ${credits} créditos para calificación de leads`,
            },
            unit_amount: Math.round(price * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenant_id,
        package_id: package_id || "custom",
        credits: String(credits),
        user_id: user.id,
        billing_order_id: billingOrder.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing?success=true&credits=${credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing?canceled=true`,
    });

    // Attach checkout session to billing order for reconciliation
    await queryWithTimeout(
      (supabase as any)
        .from("billing_orders")
        .update({
          stripe_checkout_session_id: session.id,
        })
        .eq("id", billingOrder.id),
      10000,
      "update billing order with session"
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

