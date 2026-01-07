import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { withRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import Stripe from "stripe";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, handleNotFound, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logCreditPurchase } from "@/lib/monitoring/audit";
import type { MembershipWithRole } from "@/types/supabase-helpers";
import type { Tenant } from "@/types/database";
import { billingCheckoutSessionBodySchema, validateBody } from "@/lib/validation/schemas";

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
      return handleUnauthorized("Debes iniciar sesión para realizar una compra");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, billingCheckoutSessionBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const { tenant_id, package_id } = bodyValidation.data;

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

    const typedMembership = membership as MembershipWithRole | null;
    if (!typedMembership || !["OWNER", "ADMIN", "BILLING"].includes(typedMembership.role)) {
      return handleForbidden("No tienes permisos de facturación para este tenant");
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
      return handleNotFound("Tenant", { tenant_id });
    }

    // SECURITY: Get pricing from server-side data, NOT from client
    interface TenantPricingRow {
      packages: Array<{ id: string; name: string; credits: number; price: number }>;
    }
    
    const { data: tenantPricing } = await queryWithTimeout(
      admin
        .from("tenant_pricing")
        .select("packages")
        .eq("tenant_id", tenant_id)
        .maybeSingle(),
      10000,
      "get tenant pricing"
    ) as { data: TenantPricingRow | null; error: unknown };

    // Use tenant-specific packages or fallback to defaults
    const packages = tenantPricing?.packages || DEFAULT_PACKAGES;
    
    // Find the requested package from SERVER data
    interface CreditPackage {
      id: string;
      name: string;
      credits: number;
      price: number;
    }
    
    const selectedPackage = packages.find((p: CreditPackage) => p.id === package_id);
    
    if (!selectedPackage) {
      logger.warn("SECURITY: Invalid package_id requested", {
        tenant_id,
        package_id,
        user_id: user.id,
      });
      return handleApiError(new Error("Invalid package_id"), {
        code: ErrorCode.INVALID_INPUT,
        status: 400,
        message: "El paquete solicitado no existe o no está disponible",
        context: { tenant_id, package_id },
        sendToSentry: true, // Security issue - log to Sentry
      });
    }

    // Use SERVER-SIDE values, not client-provided values
    const serverPrice = selectedPackage.price;
    const serverCredits = selectedPackage.credits;

    // Create or get Stripe customer (stored in stripe_customers table)
    let customerId: string | null = null;

    interface StripeCustomerRow {
      stripe_customer_id: string;
    }
    
    const { data: existingCustomer } = await queryWithTimeout(
      admin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("tenant_id", tenant_id)
        .maybeSingle(),
      10000,
      "get existing Stripe customer"
    ) as { data: StripeCustomerRow | null; error: unknown };

    if (existingCustomer?.stripe_customer_id) {
      customerId = existingCustomer.stripe_customer_id;
    } else {
      const typedTenant = tenant as Tenant;
      const customer = await stripe.customers.create({
        name: typedTenant.name,
        metadata: { tenant_id },
      });

      customerId = customer.id;

      await queryWithTimeout(
        admin.from("stripe_customers").insert({
          tenant_id,
          stripe_customer_id: customerId,
          billing_email: user.email,
          billing_name: typedTenant.name,
          metadata: { created_by_user_id: user.id },
        }),
        10000,
        "create Stripe customer"
      );
    }

    // Create billing order (pending) with SERVER-SIDE prices
    interface BillingOrderRow {
      id: string;
      order_number: string;
    }
    
    const { data: billingOrder, error: orderError } = await queryWithTimeout(
      supabase
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
    ) as { data: BillingOrderRow | null; error: unknown };

    if (orderError || !billingOrder) {
      return handleApiError(orderError || new Error("Failed to create billing order"), {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo crear la orden de facturación",
        context: { tenant_id, package_id },
      });
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
        billing_order_id: billingOrder.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing?success=true&credits=${serverCredits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing?canceled=true`,
    });

    // Attach checkout session to billing order for reconciliation
    await queryWithTimeout(
      supabase
        .from("billing_orders")
        .update({
          stripe_checkout_session_id: session.id,
        })
        .eq("id", billingOrder.id),
      10000,
      "update billing order with session"
    );

    // Log audit event (note: actual credit addition happens in webhook)
    await logCreditPurchase(
      user.id,
      tenant_id,
      billingOrder.id,
      serverPrice,
      serverCredits,
      package_id,
      request
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.EXTERNAL_API_ERROR,
      status: 500,
      message: "No se pudo crear la sesión de pago",
      context: { operation: "stripe_checkout" },
    });
  }
}
