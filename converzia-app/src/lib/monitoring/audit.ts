/**
 * Audit Logging Module
 * 
 * Provides functions to log critical actions for compliance and security auditing.
 * All audit logs are stored in the audit_logs table with RLS policies.
 */

import { createClient } from "@/lib/supabase/server";
import { rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import { unsafeRpc } from "@/lib/supabase/unsafe-rpc";
import { logger } from "@/lib/utils/logger";

// ============================================
// Types
// ============================================

export type AuditAction =
  // Tenant actions
  | "tenant_created"
  | "tenant_updated"
  | "tenant_deleted"
  | "tenant_settings_updated"
  // User actions
  | "user_invited"
  | "user_role_changed"
  | "user_removed"
  | "user_activated"
  | "user_deactivated"
  // Credit actions
  | "credit_purchased"
  | "credit_refunded"
  | "credit_consumed"
  | "trial_credits_granted"
  // Lead actions
  | "lead_created"
  | "lead_updated"
  | "lead_deleted"
  | "lead_pii_deleted" // GDPR deletion
  | "lead_opted_out"
  // Delivery actions
  | "delivery_completed"
  | "delivery_failed"
  | "delivery_refunded"
  | "delivery_retried"
  // Integration actions
  | "integration_connected"
  | "integration_disconnected"
  | "integration_config_updated"
  // Offer actions
  | "offer_created"
  | "offer_updated"
  | "offer_deleted"
  // RAG/Knowledge actions
  | "rag_document_ingested"
  | "rag_document_deleted"
  | "rag_source_approved"
  | "rag_source_rejected"
  // Billing actions
  | "billing_order_created"
  | "billing_order_completed"
  | "billing_order_cancelled"
  // Admin actions
  | "admin_action_performed";

export type AuditEntityType =
  | "tenant"
  | "user"
  | "tenant_member"
  | "credit_ledger"
  | "lead"
  | "delivery"
  | "integration"
  | "offer"
  | "rag_document"
  | "rag_source"
  | "billing_order"
  | "system";

export interface AuditEventMetadata {
  [key: string]: unknown;
  ip?: string;
  user_agent?: string;
  reason?: string;
  amount?: number;
  currency?: string;
  package_id?: string;
  credits?: number;
}

export interface AuditLogResult {
  success: boolean;
  audit_id?: string;
  error?: string;
}

// ============================================
// Helper function to extract IP and User Agent from request
// ============================================

export function extractRequestMetadata(request?: Request): {
  ip?: string;
  user_agent?: string;
} {
  if (!request) return {};

  // Extract IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || undefined;

  // Extract User Agent
  const userAgent = request.headers.get("user-agent") || undefined;

  return { ip, user_agent: userAgent };
}

// ============================================
// Main Audit Logging Function
// ============================================

/**
 * Log an audit event to the database
 * 
 * @param params - Audit event parameters
 * @returns Audit log ID if successful, null otherwise
 */
export async function logAuditEvent(params: {
  user_id: string;
  tenant_id?: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: AuditEventMetadata | null;
  request?: Request;
}): Promise<AuditLogResult> {
  try {
    const supabase = await createClient();

    // Extract IP and User Agent from request if provided
    const requestMetadata = params.request
      ? extractRequestMetadata(params.request)
      : {};

    // Merge request metadata with provided metadata
    const finalMetadata: AuditEventMetadata = {
      ...params.metadata,
      ...requestMetadata,
    };

    // Call the RPC function to log the audit event
    type AuditLogResult = { audit_id: string };
    const result = await rpcWithTimeout<AuditLogResult>(
      unsafeRpc<AuditLogResult>(supabase, "log_audit_event", {
        p_user_id: params.user_id,
        p_tenant_id: params.tenant_id || null,
        p_action: params.action,
        p_entity_type: params.entity_type,
        p_entity_id: params.entity_id || null,
        p_old_values: params.old_values ? (params.old_values as unknown) : null,
        p_new_values: params.new_values ? (params.new_values as unknown) : null,
        p_metadata: finalMetadata ? (finalMetadata as unknown) : null,
        p_ip_address: finalMetadata.ip || null,
        p_user_agent: finalMetadata.user_agent || null,
      }),
      10000,
      "log_audit_event",
      false
    );

    if (result.error) {
      logger.error("Failed to log audit event", result.error, {
        action: params.action,
        entity_type: params.entity_type,
        user_id: params.user_id,
      });
      return {
        success: false,
        error: result.error instanceof Error ? result.error.message : "Unknown error",
      };
    }

    // The function returns the audit_id
    const auditId = result.data?.audit_id;

    return {
      success: true,
      audit_id: auditId,
    };
  } catch (error) {
    logger.exception("Error logging audit event", error, {
      action: params.action,
      entity_type: params.entity_type,
      user_id: params.user_id,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Convenience Functions for Common Actions
// ============================================

/**
 * Log tenant creation
 */
export async function logTenantCreated(
  userId: string,
  tenantId: string,
  tenantData: Record<string, unknown>,
  request?: Request
): Promise<AuditLogResult> {
  return logAuditEvent({
    user_id: userId,
    tenant_id: tenantId,
    action: "tenant_created",
    entity_type: "tenant",
    entity_id: tenantId,
    new_values: tenantData,
    request,
  });
}

/**
 * Log credit purchase
 */
export async function logCreditPurchase(
  userId: string,
  tenantId: string,
  orderId: string,
  amount: number,
  credits: number,
  packageId?: string,
  request?: Request
): Promise<AuditLogResult> {
  return logAuditEvent({
    user_id: userId,
    tenant_id: tenantId,
    action: "credit_purchased",
    entity_type: "billing_order",
    entity_id: orderId,
    new_values: {
      amount,
      credits,
      package_id: packageId,
    },
    metadata: {
      amount,
      credits,
      package_id: packageId,
    },
    request,
  });
}

/**
 * Log GDPR deletion
 */
export async function logGdprDeletion(
  userId: string,
  leadId: string,
  reason: string,
  oldValues: Record<string, unknown>,
  request?: Request
): Promise<AuditLogResult> {
  return logAuditEvent({
    user_id: userId,
    action: "lead_pii_deleted",
    entity_type: "lead",
    entity_id: leadId,
    old_values: oldValues,
    metadata: {
      reason,
    },
    request,
  });
}

/**
 * Log user invitation
 */
export async function logUserInvited(
  userId: string,
  tenantId: string,
  invitedUserId: string,
  role: string,
  request?: Request
): Promise<AuditLogResult> {
  return logAuditEvent({
    user_id: userId,
    tenant_id: tenantId,
    action: "user_invited",
    entity_type: "tenant_member",
    entity_id: invitedUserId,
    new_values: {
      role,
    },
    request,
  });
}

/**
 * Log role change
 */
export async function logRoleChanged(
  userId: string,
  tenantId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  request?: Request
): Promise<AuditLogResult> {
  return logAuditEvent({
    user_id: userId,
    tenant_id: tenantId,
    action: "user_role_changed",
    entity_type: "tenant_member",
    entity_id: targetUserId,
    old_values: { role: oldRole },
    new_values: { role: newRole },
    request,
  });
}

/**
 * Log integration connection/disconnection
 */
export async function logIntegrationChange(
  userId: string,
  tenantId: string | null,
  integrationId: string,
  action: "integration_connected" | "integration_disconnected" | "integration_config_updated",
  metadata?: AuditEventMetadata,
  request?: Request
): Promise<AuditLogResult> {
  return logAuditEvent({
    user_id: userId,
    tenant_id: tenantId,
    action,
    entity_type: "integration",
    entity_id: integrationId,
    metadata,
    request,
  });
}
