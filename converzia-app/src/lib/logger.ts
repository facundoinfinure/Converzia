// ============================================
// Structured Logger
// ============================================
// PII-safe logging with structured output

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  traceId?: string;
}

// PII fields that should be masked
const PII_FIELDS = [
  "phone",
  "phone_number",
  "email",
  "dni",
  "full_name",
  "first_name",
  "last_name",
  "name",
  "ip",
  "ip_address",
  "address",
];

// Mask PII fields in an object
function maskPII(obj: unknown, depth = 0): unknown {
  if (depth > 10) return "[MAX_DEPTH]";

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskPII(item, depth + 1));
  }

  if (typeof obj === "object") {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if this is a PII field
      if (PII_FIELDS.some((pii) => lowerKey.includes(pii))) {
        if (typeof value === "string" && value.length > 0) {
          // Mask string values, keeping first 2 and last 2 characters
          if (value.length <= 4) {
            masked[key] = "****";
          } else {
            masked[key] = `${value.slice(0, 2)}***${value.slice(-2)}`;
          }
        } else {
          masked[key] = "[REDACTED]";
        }
      } else {
        masked[key] = maskPII(value, depth + 1);
      }
    }

    return masked;
  }

  return obj;
}

// Global trace ID (set per request)
let currentTraceId: string | undefined;

export function setTraceId(traceId: string): void {
  currentTraceId = traceId;
}

export function getTraceId(): string | undefined {
  return currentTraceId;
}

export function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

// Format log entry as JSON string
function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

// Core logging function
function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context ? (maskPII(context) as LogContext) : undefined,
    traceId: currentTraceId,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case "debug":
      if (process.env.NODE_ENV === "development") {
        console.debug(formatted);
      }
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

// Public API
export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),

  // Convenience methods for common operations
  webhook: (event: string, context?: LogContext) =>
    log("info", `Webhook: ${event}`, { ...context, type: "webhook" }),

  delivery: (action: string, deliveryId: string, context?: LogContext) =>
    log("info", `Delivery: ${action}`, { ...context, deliveryId, type: "delivery" }),

  billing: (action: string, tenantId: string, context?: LogContext) =>
    log("info", `Billing: ${action}`, { ...context, tenantId, type: "billing" }),

  conversation: (action: string, leadOfferId: string, context?: LogContext) =>
    log("info", `Conversation: ${action}`, { ...context, leadOfferId, type: "conversation" }),

  security: (event: string, context?: LogContext) =>
    log("warn", `Security: ${event}`, { ...context, type: "security" }),

  // For errors with stack traces
  exception: (message: string, error: unknown, context?: LogContext) => {
    const errorInfo =
      error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack?.split("\n").slice(0, 5) }
        : { errorMessage: String(error) };

    log("error", message, { ...context, ...errorInfo });
  },
};

export default logger;

