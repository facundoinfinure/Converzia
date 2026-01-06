import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout, rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import type { Delivery, TenantIntegration } from "@/types";
import { createTokkoLead, TokkoConfig } from "./tokko";
import { appendToGoogleSheets, GoogleSheetsConfig } from "./google-sheets";
import type { GoogleOAuthTokens } from "@/types";
import { logger, Metrics, Alerts, startTimer } from "@/lib/monitoring";
import { retryWithBackoff, logWebhookRetry, logWebhookSuccess } from "@/lib/security/webhook-retry";

// ============================================
// Delivery Pipeline Service
// ============================================

const MAX_RETRY_COUNT = 3;

interface DeliveryResult {
  success: boolean;
  status: "DELIVERED" | "PARTIAL" | "FAILED" | "DEAD_LETTER";
  integrationsSucceeded: string[];
  integrationsFailed: string[];
  creditConsumed: boolean;
  error?: string;
}

export async function processDelivery(deliveryId: string): Promise<DeliveryResult> {
  const timer = startTimer();
  const supabase = createAdminClient();

  logger.delivery("processing", deliveryId);

  // Get delivery with related data
  const { data: deliveryData, error } = await queryWithTimeout(
    supabase
      .from("deliveries")
      .select(`
        *,
        lead:leads(*),
        tenant:tenants(*),
        offer:offers!deliveries_offer_id_fkey(*)
      `)
      .eq("id", deliveryId)
      .single(),
    10000,
    `fetch delivery ${deliveryId}`
  );

  const delivery = deliveryData as {
    id: string;
    status: string;
    tenant_id: string;
    lead_offer_id: string;
    integrations_succeeded: string[] | null;
    integrations_failed: string[] | null;
    credit_ledger_id: string | null;
    error_message: string | null;
    retry_count: number;
    lead: any;
    tenant: any;
    offer: any;
  } | null;

  if (error || !delivery) {
    logger.error("Delivery not found", { deliveryId, error: error?.message });
    throw new Error(`Delivery not found: ${deliveryId}`);
  }

  // Check if already processed (idempotency)
  if (delivery.status === "DELIVERED" || delivery.status === "DEAD_LETTER") {
    logger.info("Delivery already processed", { deliveryId, status: delivery.status });
    return {
      success: delivery.status === "DELIVERED",
      status: delivery.status as "DELIVERED" | "DEAD_LETTER",
      integrationsSucceeded: delivery.integrations_succeeded || [],
      integrationsFailed: delivery.integrations_failed || [],
      creditConsumed: !!delivery.credit_ledger_id,
    };
  }

  // Check if max retries exceeded - move to dead letter
  if ((delivery.retry_count || 0) >= MAX_RETRY_COUNT) {
    logger.warn("Delivery max retries exceeded, moving to dead letter", { 
      deliveryId, 
      retryCount: delivery.retry_count 
    });

    await moveToDeadLetter(
      deliveryId,
      delivery.tenant_id,
      delivery.lead_offer_id,
      `Max retries (${MAX_RETRY_COUNT}) exceeded. Last error: ${delivery.error_message || "Unknown"}`
    );

    Metrics.deliveryAttempted("dead_letter");
    Metrics.deliveryLatency(timer());

    return {
      success: false,
      status: "DEAD_LETTER",
      integrationsSucceeded: delivery.integrations_succeeded || [],
      integrationsFailed: delivery.integrations_failed || [],
      creditConsumed: false,
      error: "Max retries exceeded",
    };
  }

  // Check billing eligibility
  const canDeliver = await checkBillingEligibility(delivery.tenant_id);

  if (!canDeliver) {
    logger.warn("Insufficient credits for delivery", { deliveryId, tenantId: delivery.tenant_id });

    await queryWithTimeout(
      supabase
        .from("deliveries")
        .update({
          status: "FAILED",
          error_message: "Insufficient credits",
          retry_count: (delivery.retry_count || 0) + 1,
        })
        .eq("id", deliveryId),
      10000,
      "update delivery to FAILED (no credits)"
    );

    await queryWithTimeout(
      supabase
        .from("lead_offers")
        .update({
          billing_eligibility: "PENDING",
          billing_notes: "Insufficient credits for delivery",
        })
        .eq("id", delivery.lead_offer_id),
      10000,
      "update lead offer billing"
    );

    // Alert on low credits
    Alerts.lowCredits(delivery.tenant_id, 0, 1);

    Metrics.deliveryAttempted("failed");
    Metrics.deliveryLatency(timer());

    return {
      success: false,
      status: "FAILED",
      integrationsSucceeded: [],
      integrationsFailed: [],
      creditConsumed: false,
      error: "Insufficient credits",
    };
  }

  // Get tenant integrations (including OAuth tokens for Google Sheets)
  const { data: integrations } = await queryWithTimeout(
    supabase
      .from("tenant_integrations")
      .select("*, oauth_tokens")
      .eq("tenant_id", delivery.tenant_id)
      .eq("is_active", true),
    10000,
    "get tenant integrations"
  );

  const integrationsAttempted: string[] = [];
  const integrationsSucceeded: string[] = [];
  const integrationsFailed: string[] = [];
  const errors: string[] = [];

  // Deliver to each integration
  const integrationsArray = Array.isArray(integrations) ? integrations : [];
  for (const integration of integrationsArray) {
    integrationsAttempted.push(integration.integration_type);

    try {
      switch (integration.integration_type) {
        case "GOOGLE_SHEETS":
          await deliverToGoogleSheets(delivery as unknown as Delivery, integration);
          integrationsSucceeded.push("GOOGLE_SHEETS");
          break;
        case "TOKKO":
          await deliverToTokko(delivery as unknown as Delivery, integration);
          integrationsSucceeded.push("TOKKO");
          break;
        case "WEBHOOK":
          await deliverToWebhook(delivery as unknown as Delivery, integration);
          integrationsSucceeded.push("WEBHOOK");
          break;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      integrationsFailed.push(integration.integration_type);
      errors.push(`${integration.integration_type}: ${errorMsg}`);
      logger.error("Integration delivery failed", {
        deliveryId,
        integration: integration.integration_type,
        error: errorMsg,
      });
    }
  }

  // Determine final status based on integration results
  let finalStatus: DeliveryResult["status"];
  let creditConsumed = false;

  if (integrationsAttempted.length === 0) {
    // No integrations configured - mark as delivered (tenant setup issue)
    finalStatus = "DELIVERED";
    creditConsumed = true;
  } else if (integrationsFailed.length === 0) {
    // All succeeded
    finalStatus = "DELIVERED";
    creditConsumed = true;
  } else if (integrationsSucceeded.length > 0) {
    // Some succeeded, some failed - PARTIAL (still charge, but flag for review)
    finalStatus = "PARTIAL";
    creditConsumed = true;
  } else {
    // All failed - don't consume credit, increment retry
    finalStatus = "FAILED";
    creditConsumed = false;
    
    // Update delivery with failure details
    await queryWithTimeout(
      supabase.from("deliveries").update({
        status: finalStatus,
        integrations_attempted: integrationsAttempted,
        integrations_succeeded: integrationsSucceeded,
        integrations_failed: integrationsFailed,
        error_message: errors.join("; "),
        retry_count: (delivery.retry_count || 0) + 1,
      }).eq("id", deliveryId),
      10000,
      "update delivery status (failed)"
    );
  }

  // If delivery succeeded (DELIVERED or PARTIAL), use atomic function
  if (creditConsumed) {
    try {
      // Use atomic function for delivery completion + credit consumption
      // This ensures both operations succeed or neither does
      const { data: atomicResult, error: atomicError } = await rpcWithTimeout(
        (supabase.rpc as any)(
          "complete_delivery_and_consume_credit",
          {
            p_delivery_id: deliveryId,
            p_integrations_succeeded: integrationsSucceeded,
            p_integrations_failed: integrationsFailed,
            p_final_status: finalStatus,
          }
        ),
        30000, // 30 second timeout for critical delivery operation
        "complete_delivery_and_consume_credit",
        true // Enable retry
      );

      if (atomicError) {
        throw new Error(atomicError.message);
      }

      const result = (Array.isArray(atomicResult) ? atomicResult[0] : atomicResult) as { success: boolean; message?: string; credit_consumed?: boolean; new_balance?: number } | null;

      if (!result?.success) {
        throw new Error(result?.message || "Atomic delivery completion failed");
      }

      creditConsumed = result.credit_consumed || false;

      if (creditConsumed) {
        Metrics.creditConsumed(delivery.tenant_id);
        logger.billing("credit_consumed", delivery.tenant_id, { 
          deliveryId, 
          newBalance: result.new_balance 
        });
      }

      // Update sheets/CRM delivery timestamps if applicable
      if (integrationsSucceeded.includes("GOOGLE_SHEETS") || integrationsSucceeded.includes("TOKKO")) {
        const timestampUpdate: Record<string, unknown> = {};
        if (integrationsSucceeded.includes("GOOGLE_SHEETS")) {
          timestampUpdate.sheets_delivered_at = new Date().toISOString();
        }
        if (integrationsSucceeded.includes("TOKKO")) {
          timestampUpdate.crm_delivered_at = new Date().toISOString();
        }
        await queryWithTimeout(
          supabase.from("deliveries").update(timestampUpdate).eq("id", deliveryId),
          10000,
          "update integration timestamps"
        );
      }

    } catch (err) {
      // Atomic operation failed - critical error
      logger.exception("Atomic delivery completion failed", err, { 
        deliveryId, 
        tenantId: delivery.tenant_id 
      });
      Alerts.creditConsumptionFailed(
        delivery.tenant_id,
        deliveryId,
        err instanceof Error ? err.message : "Unknown"
      );

      // Mark delivery as failed so it can be retried
      await queryWithTimeout(
        supabase.from("deliveries").update({
          status: "FAILED",
          error_message: `Atomic completion failed: ${err instanceof Error ? err.message : "Unknown"}`,
          retry_count: (delivery.retry_count || 0) + 1,
        }).eq("id", deliveryId),
        10000,
        "update delivery after atomic failure"
      );

      creditConsumed = false;
      finalStatus = "FAILED";
    }
  }

  // Log metrics
  Metrics.deliveryAttempted(
    finalStatus === "DELIVERED" ? "success" :
    finalStatus === "PARTIAL" ? "partial" : "failed"
  );
  Metrics.deliveryLatency(timer());

  logger.delivery("completed", deliveryId, {
    status: finalStatus,
    integrationsSucceeded,
    integrationsFailed,
    creditConsumed,
  });

  return {
    success: finalStatus === "DELIVERED" || finalStatus === "PARTIAL",
    status: finalStatus,
    integrationsSucceeded,
    integrationsFailed,
    creditConsumed,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ============================================
// Move to Dead Letter Queue
// ============================================

async function moveToDeadLetter(
  deliveryId: string,
  tenantId: string,
  leadOfferId: string,
  reason: string
): Promise<void> {
  const supabase = createAdminClient();

  await rpcWithTimeout(
    (supabase.rpc as any)("move_to_dead_letter", {
      p_delivery_id: deliveryId,
      p_reason: reason,
    }),
    15000, // 15 second timeout for dead letter operation
    "move_to_dead_letter",
    true // Enable retry
  );

  // Alert on dead letter
  Alerts.deliveryDeadLetter(deliveryId, reason, tenantId);

  logger.error("Delivery moved to dead letter", { deliveryId, reason, tenantId });
}

// ============================================
// Check Billing Eligibility
// ============================================

async function checkBillingEligibility(tenantId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: balanceData } = await queryWithTimeout(
    supabase
      .from("tenant_credit_balance")
      .select("current_balance")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    5000,
    "check billing eligibility",
    false // Don't retry balance checks
  );
  
  const balance = balanceData as { current_balance: number } | null;

  return (balance?.current_balance || 0) >= 1;
}

// ============================================
// Consume Credit (Idempotent)
// ============================================

async function consumeCredit(
  tenantId: string,
  leadOfferId: string,
  deliveryId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Idempotency check: see if we already consumed credit for this delivery
  const { data: existingLedger } = await queryWithTimeout(
    supabase
      .from("credit_ledger")
      .select("id")
      .eq("delivery_id", deliveryId)
      .eq("transaction_type", "CREDIT_CONSUMPTION")
      .maybeSingle(),
    5000,
    "check existing credit consumption"
  );

  if (existingLedger) {
    logger.info("Credit already consumed for delivery (idempotent)", { deliveryId });
    return;
  }

  // Atomic credit consumption (locks per-tenant)
  const { data, error } = await rpcWithTimeout(
    (supabase.rpc as any)("consume_credit", {
      p_tenant_id: tenantId,
      p_delivery_id: deliveryId,
      p_lead_offer_id: leadOfferId,
      p_description: "Lead delivery",
    }),
    20000, // 20 second timeout for credit consumption
    "consume_credit",
    true // Enable retry
  );

  if (error) {
    throw new Error(error.message);
  }

  // `consume_credit` returns table(success, new_balance, message)
  const row = Array.isArray(data) ? data[0] : data;
  if (!(row as { success?: boolean })?.success) {
    throw new Error((row as { message?: string })?.message || "Insufficient credits");
  }

  // Backfill delivery.credit_ledger_id for traceability
  const { data: ledgerData } = await queryWithTimeout(
    supabase
      .from("credit_ledger")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("delivery_id", deliveryId)
      .eq("transaction_type", "CREDIT_CONSUMPTION")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    10000,
    "get credit ledger entry"
  );
  
  const ledger = ledgerData as { id: string } | null;

  if (ledger?.id) {
    await queryWithTimeout(
      supabase
        .from("deliveries")
        .update({ credit_ledger_id: ledger.id })
        .eq("id", deliveryId),
      10000,
      "update delivery credit ledger"
    );
  }

  logger.billing("credit_consumed", tenantId, { deliveryId, newBalance: (row as { new_balance?: number })?.new_balance });
}

// ============================================
// Deliver to Google Sheets
// ============================================

async function deliverToGoogleSheets(
  delivery: Delivery,
  integration: TenantIntegration & { oauth_tokens?: GoogleOAuthTokens | null }
): Promise<void> {
  const config = integration.config as GoogleSheetsConfig;
  const oauthTokens = integration.oauth_tokens;

  // Validate config - either OAuth tokens or service account must be present
  if (!config.spreadsheet_id || !config.sheet_name) {
    throw new Error("Google Sheets not properly configured - missing spreadsheet ID or sheet name");
  }

  const hasOAuth = !!oauthTokens?.access_token;
  const hasServiceAccount = !!(config as { service_account_json?: string }).service_account_json;

  if (!hasOAuth && !hasServiceAccount) {
    throw new Error("Google Sheets not properly configured - no authentication method available");
  }

  // Retry with exponential backoff
  let attempt = 0;
  const result = await retryWithBackoff(
    async () => {
      attempt++;
      try {
        return await appendToGoogleSheets(delivery, config, oauthTokens, integration.id);
      } catch (error) {
        logWebhookRetry("GOOGLE_SHEETS", attempt, 3, error);
        throw error;
      }
    },
    { maxRetries: 3, initialDelayMs: 1000 }
  );
  if (attempt > 1) logWebhookSuccess("GOOGLE_SHEETS", attempt);

  if (!result.success) {
    // Alert if all retries failed
    if (attempt >= 3) {
      Alerts.webhookFailed("GOOGLE_SHEETS", delivery.id, result.error || "Unknown error", attempt);
    }
    throw new Error(result.error || "Failed to append to Google Sheets");
  }

  // Update delivery with Sheets row info
  const supabase = createAdminClient();
  await queryWithTimeout(
    supabase
      .from("deliveries")
      .update({
        sheets_row_id: result.row_number ? String(result.row_number) : null,
        sheets_delivered_at: new Date().toISOString(),
      })
      .eq("id", delivery.id),
    10000,
    "update delivery with Sheets row info"
  );

  logger.info("Delivered to Google Sheets", { deliveryId: delivery.id, rowNumber: result.row_number });
}

// ============================================
// Deliver to Tokko CRM
// ============================================

async function deliverToTokko(
  delivery: Delivery,
  integration: TenantIntegration
): Promise<void> {
  const config = integration.config as TokkoConfig;

  if (!config.api_key) {
    throw new Error("Tokko not properly configured - missing API key");
  }

      // Retry with exponential backoff
      let attempt = 0;
      const result = await retryWithBackoff(
        async () => {
          attempt++;
          try {
            return await createTokkoLead(delivery, config);
          } catch (error) {
            logWebhookRetry("TOKKO", attempt, 3, error);
            throw error;
          }
        },
        { maxRetries: 3, initialDelayMs: 1000 }
      );
      if (attempt > 1) logWebhookSuccess("TOKKO", attempt);

  if (!result.success) {
    throw new Error(result.error || "Failed to create lead in Tokko");
  }

  // Update delivery with CRM record info
  const supabase = createAdminClient();
  await queryWithTimeout(
    supabase
      .from("deliveries")
      .update({
        crm_record_id: result.contact_id || null,
        crm_delivered_at: new Date().toISOString(),
      })
      .eq("id", delivery.id),
    10000,
    "update delivery with Tokko contact info"
  );

  logger.info("Delivered to Tokko", { deliveryId: delivery.id, contactId: result.contact_id });
}

// ============================================
// Deliver to Webhook
// ============================================

async function deliverToWebhook(
  delivery: Delivery,
  integration: TenantIntegration
): Promise<void> {
  const config = integration.config as {
    url: string;
    method: string;
    headers: Record<string, string>;
    auth_type: string;
    auth_value?: string;
  };

  if (!config.url) {
    throw new Error("Webhook URL not configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };

  // Add auth header
  if (config.auth_type === "bearer" && config.auth_value) {
    headers["Authorization"] = `Bearer ${config.auth_value}`;
  } else if (config.auth_type === "api_key" && config.auth_value) {
    headers["X-API-Key"] = config.auth_value;
  }

  const response = await fetch(config.url, {
    method: config.method || "POST",
    headers,
    body: JSON.stringify(delivery.payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
  }

  const supabase = createAdminClient();
  await queryWithTimeout(
    supabase
      .from("tenant_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id),
    10000,
    "update integration last sync"
  );

  logger.info("Delivered to webhook", { deliveryId: delivery.id, url: config.url });
}

// ============================================
// Refund Credit
// ============================================

export async function refundCredit(
  deliveryId: string,
  reason: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: delivery } = await queryWithTimeout(
    supabase
      .from("deliveries")
      .select("*, credit_ledger_id")
      .eq("id", deliveryId)
      .single(),
    10000,
    `fetch delivery ${deliveryId} for refund`
  );

  const typedDelivery = delivery as { status: string; tenant_id: string; lead_offer_id: string } | null;
  
  if (!typedDelivery || typedDelivery.status === "REFUNDED") {
    throw new Error("Cannot refund this delivery");
  }

  // Atomic refund via DB function
  const { error: refundError } = await rpcWithTimeout(
    (supabase.rpc as any)("refund_credit", {
      p_tenant_id: typedDelivery.tenant_id,
      p_delivery_id: deliveryId,
      p_lead_offer_id: typedDelivery.lead_offer_id,
      p_reason: reason,
      p_created_by: null,
    }),
    20000, // 20 second timeout for credit refund
    "refund_credit",
    true // Enable retry
  );

  if (refundError) {
    throw new Error(refundError.message);
  }

  // Update lead offer
  await queryWithTimeout(
    supabase
      .from("lead_offers")
      .update({
        billing_eligibility: "PENDING",
        billing_notes: `Refunded: ${reason}`,
      })
      .eq("id", typedDelivery.lead_offer_id),
    10000,
    "update lead offer after refund"
  );

  Metrics.creditRefunded(typedDelivery.tenant_id);
  logger.billing("credit_refunded", typedDelivery.tenant_id, { deliveryId, reason });
}

// ============================================
// Get Dead Letter Queue Items
// ============================================

export async function getDeadLetterQueue(tenantId?: string): Promise<Delivery[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("deliveries")
    .select(`
      *,
      lead:leads(id, phone, full_name),
      offer:offers!deliveries_offer_id_fkey(id, name)
    `)
    .eq("status", "DEAD_LETTER")
    .order("dead_letter_at", { ascending: false });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data } = await queryWithTimeout(query, 10000, "get dead letter queue");

  return (data || []) as Delivery[];
}

// ============================================
// Retry Dead Letter Delivery
// ============================================

export async function retryDeadLetterDelivery(deliveryId: string): Promise<DeliveryResult> {
  const supabase = createAdminClient();

  // Reset the delivery to PENDING
  await queryWithTimeout(
    supabase
      .from("deliveries")
      .update({
        status: "PENDING",
        retry_count: 0,
        dead_letter_at: null,
        dead_letter_reason: null,
        error_message: null,
      })
      .eq("id", deliveryId)
      .eq("status", "DEAD_LETTER"),
    10000,
    "reset dead letter delivery"
  );

  logger.info("Retrying dead letter delivery", { deliveryId });

  // Process again
  return processDelivery(deliveryId);
}
