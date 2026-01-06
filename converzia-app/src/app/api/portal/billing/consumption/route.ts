import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

/**
 * Generate Stripe invoice URL from available identifiers
 */
function generateInvoiceUrl(
  invoiceUrl: string | null,
  stripeInvoiceId: string | null,
  stripeCheckoutSessionId: string | null
): string | null {
  if (invoiceUrl) {
    return invoiceUrl;
  }
  
  if (stripeInvoiceId) {
    return `https://dashboard.stripe.com/invoices/${stripeInvoiceId}`;
  }
  
  if (stripeCheckoutSessionId) {
    // For checkout sessions, we can link to the session
    return `https://dashboard.stripe.com/payments/${stripeCheckoutSessionId}`;
  }
  
  return null;
}

/**
 * GET /api/portal/billing/consumption
 * 
 * Returns unified billing history including both credit purchases and consumptions.
 * Query params:
 * - offer_id: Filter by specific offer (optional, only for consumptions)
 * - from: Start date (optional)
 * - to: End date (optional)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[Billing Consumption] Auth error:", {
        error: authError,
        hasUser: !!user,
      });
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    
    console.log("[Billing Consumption] User authenticated:", {
      userId: user.id,
      email: user.email,
    });
    
    // Get user's active tenant membership
    const { data: membershipData, error: membershipError } = await queryWithTimeout(
      supabase
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .single(),
      5000,
      "get tenant membership"
    );
    
    if (membershipError) {
      console.error("[Billing Consumption] Membership query failed:", {
        userId: user.id,
        error: membershipError,
      });
    }
    
    const membership = membershipData as { tenant_id: string; role: string } | null;
    
    if (!membership) {
      console.error("[Billing Consumption] No active membership found:", {
        userId: user.id,
      });
      return NextResponse.json({ error: "No tiene acceso a ningún tenant" }, { status: 403 });
    }
    
    const tenantId = membership.tenant_id;
    
    console.log("[Billing Consumption] Tenant membership verified:", {
      userId: user.id,
      tenantId,
      role: membership.role,
    });
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get("offer_id");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    
    // Query credit_ledger for all transactions (purchases and consumptions)
    // Optimized: Limit joins and use more efficient query structure
    let ledgerQuery = supabase
      .from("credit_ledger")
      .select(`
        id,
        transaction_type,
        amount,
        balance_after,
        description,
        created_at,
        billing_order_id,
        delivery_id,
        lead_offer_id,
        created_by,
        billing_order:billing_orders(
          id,
          package_name,
          credits_purchased,
          total,
          currency,
          invoice_url,
          stripe_invoice_id,
          stripe_checkout_session_id
        ),
        purchaser:user_profiles!credit_ledger_created_by_fkey(
          full_name,
          email
        ),
        delivery:deliveries(
          id,
          lead_offer_id,
          status
        ),
        lead_offer:lead_offers(
          id,
          offer_id,
          status,
          offer:offers!lead_offers_offer_id_fkey(name),
          lead:leads(
            id,
            full_name,
            phone,
            email
          )
        )
      `)
      .eq("tenant_id", tenantId)
      .in("transaction_type", ["CREDIT_PURCHASE", "CREDIT_CONSUMPTION", "CREDIT_REFUND"])
      .order("created_at", { ascending: false })
      .limit(100); // Limit to prevent huge queries
    
    if (fromDate) {
      ledgerQuery = ledgerQuery.gte("created_at", fromDate);
    }
    
    if (toDate) {
      ledgerQuery = ledgerQuery.lte("created_at", toDate);
    }
    
    const { data: ledgerData, error: ledgerError, count } = await queryWithTimeout(
      ledgerQuery,
      12000, // Reduced from 15000
      "get credit ledger",
      false // Don't retry - billing queries should fail fast
    );
    
    if (ledgerError) {
      console.error("[Billing Consumption] Ledger query failed:", {
        tenantId,
        code: ledgerError.code,
        message: ledgerError.message,
        details: ledgerError.details,
        hint: ledgerError.hint,
      });
      return NextResponse.json({ 
        error: "Error al obtener historial",
        details: ledgerError.message 
      }, { status: 500 });
    }
    
    console.log("[Billing Consumption] Ledger query result:", {
      tenantId,
      transactionCount: Array.isArray(ledgerData) ? ledgerData.length : 0,
      hasData: !!ledgerData,
    });
    
    // Transform and filter transactions
    const allTransactions = (Array.isArray(ledgerData) ? ledgerData : []).map((tx: any) => {
      const isPurchase = tx.transaction_type === "CREDIT_PURCHASE";
      const billingOrder = Array.isArray(tx.billing_order) ? tx.billing_order[0] : tx.billing_order;
      const purchaser = Array.isArray(tx.purchaser) ? tx.purchaser[0] : tx.purchaser;
      const delivery = Array.isArray(tx.delivery) ? tx.delivery[0] : tx.delivery;
      const leadOffer = Array.isArray(tx.lead_offer) ? tx.lead_offer[0] : tx.lead_offer;
      const offer = leadOffer?.offer ? (Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer) : null;
      const lead = leadOffer?.lead ? (Array.isArray(leadOffer.lead) ? leadOffer.lead[0] : leadOffer.lead) : null;
      
      if (isPurchase) {
        // Purchase transaction
        const invoiceUrl = billingOrder ? generateInvoiceUrl(
          billingOrder.invoice_url,
          billingOrder.stripe_invoice_id,
          billingOrder.stripe_checkout_session_id
        ) : null;
        
        return {
          ledger_id: tx.id,
          tenant_id: tenantId,
          transaction_type: tx.transaction_type,
          entry_type: tx.transaction_type,
          amount: tx.amount,
          balance_after: tx.balance_after,
          created_at: tx.created_at,
          description: tx.description || billingOrder?.package_name || "Compra de créditos",
          
          // Purchase-specific fields
          package_name: billingOrder?.package_name || null,
          total: billingOrder?.total || null,
          currency: billingOrder?.currency || "USD",
          credits_purchased: billingOrder?.credits_purchased || tx.amount,
          cost_per_credit: billingOrder && billingOrder.credits_purchased > 0 
            ? Number(billingOrder.total) / billingOrder.credits_purchased 
            : null,
          purchaser_name: purchaser?.full_name || null,
          purchaser_email: purchaser?.email || null,
          billing_order_id: billingOrder?.id || tx.billing_order_id || null,
          invoice_url: invoiceUrl,
          
          // Null for purchases
          offer_id: null,
          offer_name: null,
          lead_offer_id: null,
          lead_id: null,
          lead_display_name: null,
          lead_status: null,
          delivery_id: null,
        };
      } else {
        // Consumption or refund transaction
        // Apply offer filter if specified
        if (offerId && leadOffer?.offer_id !== offerId) {
          return null;
        }
        
        // Determine lead display name (anonymized if not delivered)
        const isDelivered = delivery?.status === "DELIVERED" || leadOffer?.status === "SENT_TO_DEVELOPER";
        const leadDisplayName = isDelivered && lead?.full_name
          ? lead.full_name
          : leadOffer?.id
          ? `Lead #${leadOffer.id.substring(0, 8)}`
          : null;
        
        return {
          ledger_id: tx.id,
          tenant_id: tenantId,
          transaction_type: tx.transaction_type,
          entry_type: tx.transaction_type,
          amount: tx.amount,
          balance_after: tx.balance_after,
          created_at: tx.created_at,
          description: tx.description || (isDelivered ? "Lead entregado" : "Lead calificado"),
          
          // Consumption-specific fields
          offer_id: leadOffer?.offer_id || null,
          offer_name: offer?.name || null,
          lead_offer_id: leadOffer?.id || null,
          lead_id: lead?.id || null,
          lead_display_name: leadDisplayName,
          lead_status: leadOffer?.status || null,
          delivery_id: delivery?.id || null,
          
          // Null for consumptions
          package_name: null,
          total: null,
          currency: null,
          credits_purchased: null,
          cost_per_credit: null,
          purchaser_name: null,
          purchaser_email: null,
          billing_order_id: null,
          invoice_url: null,
        };
      }
    }).filter((tx: any) => tx !== null);
    
    // Apply pagination after filtering
    const totalCount = allTransactions.length;
    const paginatedTransactions = allTransactions.slice(offset, offset + limit);
    
    // Get current balance
    const { data: balanceData, error: balanceError } = await queryWithTimeout(
      supabase
        .from("tenant_credit_balance")
        .select("current_balance")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      5000,
      "get balance"
    );
    
    if (balanceError) {
      console.warn("[Billing Consumption] Balance query failed (non-fatal):", {
        tenantId,
        error: balanceError,
      });
    }
    
    const balance = balanceData as { current_balance: number } | null;
    
    // Get summary stats (optimized - only fetch what we need)
    const { data: summaryData } = await queryWithTimeout(
      supabase
        .from("credit_ledger")
        .select("transaction_type, amount")
        .eq("tenant_id", tenantId),
      8000, // Reduced timeout
      "get summary",
      false // Don't retry
    );
    
    const summary = Array.isArray(summaryData) ? summaryData as Array<{ transaction_type: string; amount: number }> : [];
    
    const totalPurchased = summary
      .filter((s) => s.transaction_type === 'CREDIT_PURCHASE')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    const totalConsumed = summary
      .filter((s) => s.transaction_type === 'CREDIT_CONSUMPTION')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    const totalRefunded = summary
      .filter((s) => s.transaction_type === 'CREDIT_REFUND')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    console.log("[Billing Consumption] Successfully retrieved data:", {
      tenantId,
      transactionCount: paginatedTransactions.length,
      totalCount,
      balance: balance?.current_balance || 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        balance: balance?.current_balance || 0,
        summary: {
          totalPurchased,
          totalConsumed,
          totalRefunded,
        },
        transactions: paginatedTransactions,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        }
      }
    });
  } catch (error) {
    console.error("[Billing Consumption] Unexpected error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

