import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import Stripe from "stripe";

// ============================================
// Billing Checkout - Create Stripe Session
// SECURITY: Prices are validated from server-side data, NOT from client
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

// Default packages if tenant has no custom pricing
const DEFAULT_PACKAGES = [
  { id: "starter", name: "Starter", credits: 50, price: 99 },
  { id: "professional", name: "Professional", credits: 150, price: 249 },
  { id: "enterprise", name: "Enterprise", credits: 500, price: 699 },
];

export async function POST(request: NextRequest) {
  // Rate limiting for billing operations
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.billing);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const stripe = getStripe();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_id, package_id } = body;

    // SECURITY: Only accept tenant_id and package_id from client
    // Price and credits are determined server-side
    if (!tenant_id || !package_id) {
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

    // SECURITY: Get pricing from server-side data, NOT from client
    const { data: tenantPricing } = await queryWithTimeout(
      (admin as any)
        .from("tenant_pricing")
        .select("packages")
        .eq("tenant_id", tenant_id)
        .maybeSingle(),
      10000,
      "get tenant pricing"
    );

    // Use tenant-specific packages or fallback to defaults
    const packages = (tenantPricing as any)?.packages || DEFAULT_PACKAGES;
    
    // Find the requested package from SERVER data
    const selectedPackage = packages.find((p: any) => p.id === package_id);
    
    if (!selectedPackage) {
      console.warn("SECURITY: Invalid package_id requested", {
        tenant_id,
        package_id,
        user_id: user.id,
      });
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    // Use SERVER-SIDE values, not client-provided values
    const serverPrice = selectedPackage.price;
    const serverCredits = selectedPackage.credits;

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

    if ((existingCustomer as any)?.stripe_customer_id) {
      customerId = (existingCustomer as any).stripe_customer_id;
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

    // Create billing order (pending) with SERVER-SIDE prices
    const { data: billingOrder, error: orderError } = await queryWithTimeout(
      (supabase as any)
        .from("billing_orders")
        .insert({
          tenant_id,
          package_name: package_id,
          credits_purchased: serverCredits, // Server value
          subtotal: serverPrice, // Server value
          discount_amount: 0,
          tax_amount: 0,
          total: serverPrice, // Server value
          currency: "USD",
          status: "pending",
        })
        .select("id, order_number")
        .single(),
      30000,
      "create billing order"
    );

    if (orderError || !billingOrder) {
      console.error("Failed to create billing order:", orderError);
      return NextResponse.json({ error: "Failed to create billing order" }, { status: 500 });
    }

    // Create checkout session with SERVER-SIDE prices
    const session = await stripe.checkout.sessions.create({
      customer: customerId!,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${serverCredits} Créditos Converzia`,
              description: `Paquete ${selectedPackage.name}: ${serverCredits} créditos para calificación de leads`,
            },
            unit_amount: Math.round(serverPrice * 100), // Stripe uses cents - SERVER VALUE
          },
          quantity: 1,
        },
      ],
      metadata: {
        tenant_id,
        package_id,
        credits: String(serverCredits), // Server value
        user_id: user.id,
        billing_order_id: (billingOrder as any).id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing?success=true&credits=${serverCredits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing?canceled=true`,
    });

    // Attach checkout session to billing order for reconciliation
    await queryWithTimeout(
      (supabase as any)
        .from("billing_orders")
        .update({
          stripe_checkout_session_id: session.id,
        })
        .eq("id", (billingOrder as any).id),
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
