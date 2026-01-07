import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { MembershipWithRole, CreditLedgerRowWithRelations, BillingOrderRow, PurchaserRow, DeliveryRow, LeadOfferRow, OfferRow, LeadRow, BillingConsumptionItem } from "@/types/supabase-helpers";
import { validateQuery, billingConsumptionQuerySchema } from "@/lib/validation/schemas";

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
      return handleUnauthorized("Debes iniciar sesión para ver el historial de facturación");
    }
    
    logger.info("[Billing Consumption] User authenticated", {
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
      logger.error("[Billing Consumption] Membership query failed", membershipError, {
        userId: user.id,
      });
    }
    
    const membership = membershipData as MembershipWithRole | null;
    
    if (!membership) {
      return handleForbidden("No tienes acceso a ningún tenant activo");
    }
    
    const tenantId = membership.tenant_id;
    
    logger.info("[Billing Consumption] Tenant membership verified", {
      userId: user.id,
      tenantId,
      role: membership.role,
    });
    
    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(searchParams, billingConsumptionQuerySchema);
    
    if (!queryValidation.success) {
      return handleValidationError(new Error(queryValidation.error), {
        validationError: queryValidation.error,
      });
    }
    
    const { offer_id: offerId, from: fromDate, to: toDate, page, limit } = queryValidation.data;
    const pageNum = page ?? 1;
    const limitNum = limit ?? 25;
    const offset = (pageNum - 1) * limitNum;
    
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
      return handleApiError(ledgerError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo obtener el historial de facturación",
        context: { tenantId },
      });
    }
    
    logger.info("[Billing Consumption] Ledger query result", {
      tenantId,
      transactionCount: Array.isArray(ledgerData) ? ledgerData.length : 0,
      hasData: !!ledgerData,
    });
    
    // Transform and filter transactions
    const ledgerRows = (Array.isArray(ledgerData) ? ledgerData : []) as CreditLedgerRowWithRelations[];
    const allTransactions = ledgerRows.map((tx) => {
      const isPurchase = tx.transaction_type === "CREDIT_PURCHASE";
      const billingOrder = Array.isArray(tx.billing_order) ? tx.billing_order[0] : (tx.billing_order as BillingOrderRow | null);
      const purchaser = Array.isArray(tx.purchaser) ? tx.purchaser[0] : (tx.purchaser as PurchaserRow | null);
      const delivery = Array.isArray(tx.delivery) ? tx.delivery[0] : (tx.delivery as DeliveryRow | null);
      const leadOffer = Array.isArray(tx.lead_offer) ? tx.lead_offer[0] : (tx.lead_offer as LeadOfferRow | null);
      const offer = leadOffer?.offer 
        ? (Array.isArray(leadOffer.offer) ? leadOffer.offer[0] : leadOffer.offer as OfferRow)
        : null;
      const lead = leadOffer?.lead 
        ? (Array.isArray(leadOffer.lead) ? leadOffer.lead[0] : leadOffer.lead as LeadRow)
        : null;
      
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
    }).filter((tx) => tx !== null) as BillingConsumptionItem[];
    
    // Apply pagination after filtering
    const totalCount = allTransactions.length;
    const paginatedTransactions = allTransactions.slice(offset, offset + limitNum);
    
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
      logger.warn("[Billing Consumption] Balance query failed (non-fatal)", {
        tenantId,
        error: balanceError instanceof Error ? balanceError.message : String(balanceError),
      });
    }
    
    interface BalanceRow {
      current_balance: number;
    }
    const balance = balanceData as BalanceRow | null;
    
    // Get summary stats (optimized - only fetch what we need)
    interface SummaryRow {
      transaction_type: string;
      amount: number;
    }
    
    const { data: summaryData } = await queryWithTimeout(
      supabase
        .from("credit_ledger")
        .select("transaction_type, amount")
        .eq("tenant_id", tenantId),
      8000, // Reduced timeout
      "get summary",
      false // Don't retry
    );
    
    const summary = (Array.isArray(summaryData) ? summaryData : []) as SummaryRow[];
    
    const totalPurchased = summary
      .filter((s) => s.transaction_type === 'CREDIT_PURCHASE')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    const totalConsumed = summary
      .filter((s) => s.transaction_type === 'CREDIT_CONSUMPTION')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    const totalRefunded = summary
      .filter((s) => s.transaction_type === 'CREDIT_REFUND')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    logger.info("[Billing Consumption] Successfully retrieved data", {
      tenantId,
      transactionCount: paginatedTransactions.length,
      totalCount,
      balance: balance?.current_balance || 0,
    });

    return apiSuccess({
      balance: balance?.current_balance || 0,
      summary: {
        totalPurchased,
        totalConsumed,
        totalRefunded,
      },
      transactions: paginatedTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al obtener el historial de facturación",
      context: { operation: "get_billing_consumption" },
    });
  }
}

