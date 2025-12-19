import { createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import type { Delivery, TenantIntegration } from "@/types";
import { createTokkoLead, TokkoConfig } from "./tokko";
import { appendToGoogleSheets, GoogleSheetsConfig } from "./google-sheets";

// ============================================
// Delivery Pipeline Service
// ============================================

export async function processDelivery(deliveryId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get delivery with related data
  const { data: delivery, error } = await queryWithTimeout(
    supabase
      .from("deliveries")
      .select(`
        *,
        lead:leads(*),
        tenant:tenants(*),
        offer:offers(*)
      `)
      .eq("id", deliveryId)
      .single(),
    10000,
    `fetch delivery ${deliveryId}`
  );

  if (error || !delivery) {
    throw new Error(`Delivery not found: ${deliveryId}`);
  }

  // Check billing eligibility
  const canDeliver = await checkBillingEligibility(delivery.tenant_id);

  if (!canDeliver) {
    await queryWithTimeout(
      supabase
        .from("deliveries")
        .update({
          status: "FAILED",
          error_message: "Insufficient credits",
        })
        .eq("id", deliveryId),
      10000,
      "update delivery to FAILED"
    );

    // Update lead offer
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

    return;
  }

  // Get tenant integrations
  const { data: integrations } = await queryWithTimeout(
    supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", delivery.tenant_id)
      .eq("is_active", true),
    10000,
    "get tenant integrations"
  );

  const errors: string[] = [];
  let sheetsDelivered = false;
  let crmDelivered = false;

  // Deliver to each integration
  for (const integration of integrations || []) {
    try {
      switch (integration.integration_type) {
        case "GOOGLE_SHEETS":
          await deliverToGoogleSheets(delivery, integration);
          sheetsDelivered = true;
          break;
        case "TOKKO":
          await deliverToTokko(delivery, integration);
          crmDelivered = true;
          break;
        case "WEBHOOK":
          await deliverToWebhook(delivery, integration);
          break;
      }
    } catch (err) {
      errors.push(`${integration.integration_type}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Update delivery status
  const allSucceeded = errors.length === 0 && (sheetsDelivered || crmDelivered || (integrations || []).length === 0);

  await queryWithTimeout(
    supabase
      .from("deliveries")
      .update({
        status: allSucceeded ? "DELIVERED" : errors.length > 0 ? "FAILED" : "DELIVERED",
        delivered_at: allSucceeded ? new Date().toISOString() : null,
        sheets_delivered_at: sheetsDelivered ? new Date().toISOString() : null,
        crm_delivered_at: crmDelivered ? new Date().toISOString() : null,
        error_message: errors.length > 0 ? errors.join("; ") : null,
      })
      .eq("id", deliveryId),
    10000,
    "update delivery status"
  );

  // If delivered, consume credit
  if (allSucceeded) {
    await consumeCredit(delivery.tenant_id, delivery.lead_offer_id, deliveryId);

    // Update lead offer status
    await queryWithTimeout(
      supabase
        .from("lead_offers")
        .update({
          status: "SENT_TO_DEVELOPER",
          billing_eligibility: "CHARGEABLE",
          status_changed_at: new Date().toISOString(),
        })
        .eq("id", delivery.lead_offer_id),
      10000,
      "update lead offer to SENT_TO_DEVELOPER"
    );

    // Log event
    await queryWithTimeout(
      supabase.from("lead_events").insert({
        lead_id: delivery.lead_id,
        lead_offer_id: delivery.lead_offer_id,
        event_type: "DELIVERY_COMPLETED",
        details: {
          delivery_id: deliveryId,
          integrations: (integrations || []).map((i: any) => i.integration_type),
        },
        actor_type: "SYSTEM",
      }),
      10000,
      "insert delivery completed event"
    );
  }
}

// ============================================
// Check Billing Eligibility
// ============================================

async function checkBillingEligibility(tenantId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: balance } = await queryWithTimeout(
    supabase
      .from("tenant_credit_balance")
      .select("current_balance")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    5000,
    "check billing eligibility",
    false // Don't retry balance checks
  );

  return (balance?.current_balance || 0) >= 1;
}

// ============================================
// Consume Credit
// ============================================

async function consumeCredit(
  tenantId: string,
  leadOfferId: string,
  deliveryId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Atomic credit consumption (locks per-tenant)
  // Wrap RPC call with timeout
  const rpcPromise = supabase.rpc("consume_credit", {
    p_tenant_id: tenantId,
    p_delivery_id: deliveryId,
    p_lead_offer_id: leadOfferId,
    p_description: "Lead delivery",
  });

  if (error) {
    throw new Error(error.message);
  }

  // `consume_credit` returns table(success, new_balance, message)
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success) {
    throw new Error(row?.message || "Insufficient credits");
  }

  // Backfill delivery.credit_ledger_id for traceability
  const { data: ledger } = await (supabase as any)
    .from("credit_ledger")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("delivery_id", deliveryId)
    .eq("transaction_type", "CREDIT_CONSUMPTION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ledger?.id) {
    await queryWithTimeout(
      (supabase as any)
        .from("deliveries")
        .update({ credit_ledger_id: ledger.id })
        .eq("id", deliveryId),
      10000,
      "update delivery credit ledger"
    );
  }
}

// ============================================
// Deliver to Google Sheets
// ============================================

async function deliverToGoogleSheets(
  delivery: Delivery,
  integration: TenantIntegration
): Promise<void> {
  const config = integration.config as GoogleSheetsConfig;

  if (!config.spreadsheet_id || !config.sheet_name || !config.service_account_json) {
    throw new Error("Google Sheets not properly configured - missing required fields");
  }

  // Use real Google Sheets API
  const result = await appendToGoogleSheets(delivery, config);

  if (!result.success) {
    throw new Error(result.error || "Failed to append to Google Sheets");
  }

  // Update delivery with Sheets row info
  const supabase = createAdminClient();
  await queryWithTimeout(
    supabase
      .from("deliveries")
      .update({
        sheets_row_id: result.row_number ? String(result.row_number) : null,
      sheets_delivered_at: new Date().toISOString() 
    })
    .eq("id", delivery.id);

  console.log("Successfully delivered to Google Sheets, row:", result.row_number);
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

  // Use real Tokko API
  const result = await createTokkoLead(delivery, config);

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
      crm_delivered_at: new Date().toISOString() 
    })
    .eq("id", delivery.id);

  console.log("Successfully delivered to Tokko, contact_id:", result.contact_id);
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

  console.log("Delivering to webhook:", {
    url: config.url,
    method: config.method,
    payload: delivery.payload,
  });

  // In production:
  // await fetch(config.url, { method: config.method, headers, body: JSON.stringify(delivery.payload) });

  const supabase = createAdminClient();
  await queryWithTimeout(
    supabase
      .from("tenant_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id),
    10000,
    "update integration last sync"
  );
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

  if (!delivery || delivery.status === "REFUNDED") {
    throw new Error("Cannot refund this delivery");
  }

  // Atomic refund (and delivery status update) via DB function
  const { error: refundError } = await queryWithTimeout(
    supabase.rpc("refund_credit", {
    p_tenant_id: delivery.tenant_id,
    p_delivery_id: deliveryId,
    p_lead_offer_id: delivery.lead_offer_id,
    p_reason: reason,
    p_created_by: null,
  });

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
    .eq("id", delivery.lead_offer_id);
}

// ============================================
// Helper Functions
// ============================================

function getNestedValue(obj: any, path: string): unknown {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

