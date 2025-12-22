// ============================================
// Security Logger
// Centralized logging for security-relevant events
// ============================================

export type SecurityEventType =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILED"
  | "AUTH_LOGOUT"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "WEBHOOK_SIGNATURE_MISSING"
  | "WEBHOOK_SECRET_MISSING"
  | "RATE_LIMIT_EXCEEDED"
  | "CRON_AUTH_FAILED"
  | "CRON_SECRET_MISSING"
  | "ADMIN_ACTION"
  | "PII_ACCESS"
  | "PII_DELETED"
  | "BILLING_CHECKOUT"
  | "BILLING_COMPLETED"
  | "SUSPICIOUS_ACTIVITY"
  | "CONFIG_ERROR";

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  ip?: string;
  userId?: string;
  tenantId?: string;
  path?: string;
  details?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Determine severity based on event type
 */
function getSeverity(type: SecurityEventType): SecurityEvent["severity"] {
  const severityMap: Record<SecurityEventType, SecurityEvent["severity"]> = {
    AUTH_LOGIN_SUCCESS: "low",
    AUTH_LOGIN_FAILED: "medium",
    AUTH_LOGOUT: "low",
    WEBHOOK_SIGNATURE_INVALID: "high",
    WEBHOOK_SIGNATURE_MISSING: "high",
    WEBHOOK_SECRET_MISSING: "critical",
    RATE_LIMIT_EXCEEDED: "medium",
    CRON_AUTH_FAILED: "high",
    CRON_SECRET_MISSING: "critical",
    ADMIN_ACTION: "medium",
    PII_ACCESS: "medium",
    PII_DELETED: "high",
    BILLING_CHECKOUT: "low",
    BILLING_COMPLETED: "low",
    SUSPICIOUS_ACTIVITY: "high",
    CONFIG_ERROR: "critical",
  };
  return severityMap[type] || "medium";
}

/**
 * Format log message for structured logging
 */
function formatLogMessage(event: SecurityEvent): string {
  return JSON.stringify({
    level: event.severity === "critical" || event.severity === "high" ? "error" : 
           event.severity === "medium" ? "warn" : "info",
    message: `SECURITY: ${event.type}`,
    ...event,
  });
}

/**
 * Log a security event
 * In production, this should integrate with your log aggregation service
 * (e.g., Datadog, Sentry, LogTail, etc.)
 */
export function logSecurityEvent(
  type: SecurityEventType,
  details?: {
    ip?: string;
    userId?: string;
    tenantId?: string;
    path?: string;
    extra?: Record<string, unknown>;
  }
): void {
  const event: SecurityEvent = {
    type,
    timestamp: new Date().toISOString(),
    ip: details?.ip ? `${details.ip.substring(0, 8)}...` : undefined, // Partial IP for privacy
    userId: details?.userId,
    tenantId: details?.tenantId,
    path: details?.path,
    details: details?.extra,
    severity: getSeverity(type),
  };

  const formattedMessage = formatLogMessage(event);

  // Log to appropriate console method based on severity
  switch (event.severity) {
    case "critical":
    case "high":
      console.error(formattedMessage);
      break;
    case "medium":
      console.warn(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }

  // In production, you would also:
  // 1. Send to log aggregation service
  // 2. Trigger alerts for critical events
  // 3. Store in database for analysis
  
  // Example: Send to external service
  // if (process.env.NODE_ENV === "production") {
  //   sendToLogService(event);
  // }
}

/**
 * Log failed login attempt
 */
export function logFailedLogin(ip: string, email?: string): void {
  logSecurityEvent("AUTH_LOGIN_FAILED", {
    ip,
    extra: { email: email ? `${email.substring(0, 3)}***` : undefined },
  });
}

/**
 * Log successful login
 */
export function logSuccessfulLogin(userId: string, ip: string): void {
  logSecurityEvent("AUTH_LOGIN_SUCCESS", { ip, userId });
}

/**
 * Log webhook signature failure
 */
export function logWebhookSignatureFailure(
  service: "stripe" | "meta" | "chatwoot",
  ip: string,
  hasSignature: boolean
): void {
  logSecurityEvent(
    hasSignature ? "WEBHOOK_SIGNATURE_INVALID" : "WEBHOOK_SIGNATURE_MISSING",
    {
      ip,
      extra: { service, hasSignature },
    }
  );
}

/**
 * Log rate limit exceeded
 */
export function logRateLimitExceeded(
  ip: string,
  endpoint: string,
  limit: number
): void {
  logSecurityEvent("RATE_LIMIT_EXCEEDED", {
    ip,
    path: endpoint,
    extra: { limit },
  });
}

/**
 * Log admin action for audit trail
 */
export function logAdminAction(
  userId: string,
  action: string,
  details?: Record<string, unknown>
): void {
  logSecurityEvent("ADMIN_ACTION", {
    userId,
    extra: { action, ...details },
  });
}

/**
 * Log PII access for compliance
 */
export function logPIIAccess(
  userId: string,
  leadId: string,
  accessType: "view" | "export" | "delete"
): void {
  logSecurityEvent("PII_ACCESS", {
    userId,
    extra: { leadId, accessType },
  });
}

/**
 * Log suspicious activity
 */
export function logSuspiciousActivity(
  ip: string,
  reason: string,
  details?: Record<string, unknown>
): void {
  logSecurityEvent("SUSPICIOUS_ACTIVITY", {
    ip,
    extra: { reason, ...details },
  });
}

/**
 * Log configuration error
 */
export function logConfigError(missingVar: string): void {
  logSecurityEvent("CONFIG_ERROR", {
    extra: { missingVar },
  });
}

/**
 * Create a security context for request tracking
 */
export function createSecurityContext(
  ip: string,
  path: string,
  userId?: string
): { log: (type: SecurityEventType, extra?: Record<string, unknown>) => void } {
  return {
    log: (type: SecurityEventType, extra?: Record<string, unknown>) => {
      logSecurityEvent(type, { ip, path, userId, extra });
    },
  };
}

