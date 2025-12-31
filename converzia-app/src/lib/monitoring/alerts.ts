// ============================================
// Alerting Module
// ============================================
// Alert triggers and notification dispatch

import { logger } from "@/lib/logger";

type AlertSeverity = "critical" | "warning" | "info";
type AlertChannel = "slack" | "email" | "webhook";

interface AlertConfig {
  name: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldownMs: number; // Minimum time between alerts
}

interface Alert {
  config: AlertConfig;
  message: string;
  context: Record<string, unknown>;
  timestamp: Date;
}

// Track last alert times for cooldown
const lastAlertTimes: Map<string, number> = new Map();

// ============================================
// Predefined Alert Configurations
// ============================================

const ALERT_CONFIGS: Record<string, AlertConfig> = {
  // Critical alerts (P0)
  delivery_dead_letter: {
    name: "Delivery Dead Letter",
    severity: "critical",
    channels: ["slack", "email"],
    cooldownMs: 5 * 60 * 1000, // 5 minutes
  },
  credit_consumption_failed: {
    name: "Credit Consumption Failed",
    severity: "critical",
    channels: ["slack"],
    cooldownMs: 1 * 60 * 1000, // 1 minute
  },
  webhook_signature_invalid: {
    name: "Invalid Webhook Signature",
    severity: "critical",
    channels: ["slack"],
    cooldownMs: 1 * 60 * 1000,
  },
  pii_encryption_missing: {
    name: "PII Encryption Key Missing",
    severity: "critical",
    channels: ["slack", "email"],
    cooldownMs: 60 * 60 * 1000, // 1 hour (don't spam)
  },

  // Warning alerts (P1)
  low_credits: {
    name: "Low Credit Balance",
    severity: "warning",
    channels: ["slack"],
    cooldownMs: 60 * 60 * 1000, // 1 hour
  },
  high_error_rate: {
    name: "High Error Rate",
    severity: "warning",
    channels: ["slack"],
    cooldownMs: 15 * 60 * 1000, // 15 minutes
  },
  delivery_retry_exceeded: {
    name: "Delivery Retry Exceeded",
    severity: "warning",
    channels: ["slack"],
    cooldownMs: 10 * 60 * 1000,
  },
  chatwoot_send_failed: {
    name: "Chatwoot Send Failed",
    severity: "warning",
    channels: ["slack"],
    cooldownMs: 5 * 60 * 1000,
  },
  openai_rate_limited: {
    name: "OpenAI Rate Limited",
    severity: "warning",
    channels: ["slack"],
    cooldownMs: 5 * 60 * 1000,
  },

  // Info alerts (P2)
  new_tenant_registered: {
    name: "New Tenant Registered",
    severity: "info",
    channels: ["slack"],
    cooldownMs: 0, // No cooldown
  },
  large_credit_purchase: {
    name: "Large Credit Purchase",
    severity: "info",
    channels: ["slack"],
    cooldownMs: 0,
  },
};

// ============================================
// Alert Sending
// ============================================

async function sendToSlack(alert: Alert): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn("SLACK_WEBHOOK_URL not configured, skipping Slack alert");
    return;
  }

  const emoji =
    alert.config.severity === "critical"
      ? "🚨"
      : alert.config.severity === "warning"
        ? "⚠️"
        : "ℹ️";

  const color =
    alert.config.severity === "critical"
      ? "#dc3545"
      : alert.config.severity === "warning"
        ? "#ffc107"
        : "#17a2b8";

  const payload = {
    attachments: [
      {
        color,
        title: `${emoji} ${alert.config.name}`,
        text: alert.message,
        fields: Object.entries(alert.context).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true,
        })),
        footer: "Converzia Alerts",
        ts: Math.floor(alert.timestamp.getTime() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error("Failed to send Slack alert", { status: response.status });
    }
  } catch (error) {
    logger.exception("Error sending Slack alert", error);
  }
}

async function sendToEmail(alert: Alert): Promise<void> {
  // TODO: Implement email sending (Resend, SendGrid, etc.)
  logger.info("Email alert would be sent", {
    alertName: alert.config.name,
    severity: alert.config.severity,
    message: alert.message,
  });
}

async function sendToWebhook(alert: Alert): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: alert.config.name,
        severity: alert.config.severity,
        message: alert.message,
        context: alert.context,
        timestamp: alert.timestamp.toISOString(),
      }),
    });
  } catch (error) {
    logger.exception("Error sending webhook alert", error);
  }
}

// ============================================
// Alert Trigger Functions
// ============================================

async function triggerAlert(
  alertType: keyof typeof ALERT_CONFIGS,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const config = ALERT_CONFIGS[alertType];
  if (!config) {
    logger.warn("Unknown alert type", { alertType });
    return;
  }

  // Check cooldown
  const lastTime = lastAlertTimes.get(alertType) || 0;
  const now = Date.now();

  if (now - lastTime < config.cooldownMs) {
    logger.debug("Alert skipped due to cooldown", { alertType });
    return;
  }

  lastAlertTimes.set(alertType, now);

  const alert: Alert = {
    config,
    message,
    context,
    timestamp: new Date(),
  };

  // Log the alert
  logger.warn(`Alert triggered: ${config.name}`, {
    severity: config.severity,
    message,
    context,
  });

  // Send to all configured channels
  const sends = config.channels.map((channel) => {
    switch (channel) {
      case "slack":
        return sendToSlack(alert);
      case "email":
        return sendToEmail(alert);
      case "webhook":
        return sendToWebhook(alert);
    }
  });

  await Promise.allSettled(sends);
}

// ============================================
// Public Alert API
// ============================================

export const Alerts = {
  // Critical (P0)
  deliveryDeadLetter: (deliveryId: string, error: string, tenantId: string) =>
    triggerAlert("delivery_dead_letter", `Delivery ${deliveryId} moved to dead letter after max retries`, {
      deliveryId,
      error,
      tenantId,
    }),

  creditConsumptionFailed: (tenantId: string, deliveryId: string, error: string) =>
    triggerAlert("credit_consumption_failed", `Failed to consume credit for delivery ${deliveryId}`, {
      tenantId,
      deliveryId,
      error,
    }),

  webhookSignatureInvalid: (source: string, ip: string) =>
    triggerAlert("webhook_signature_invalid", `Invalid webhook signature from ${source}`, {
      source,
      ip,
    }),

  piiEncryptionMissing: (field: string) =>
    triggerAlert("pii_encryption_missing", `PII encryption key not configured, ${field} data at risk`, {
      field,
    }),

  // Warning (P1)
  lowCredits: (tenantId: string, balance: number, threshold: number) =>
    triggerAlert("low_credits", `Tenant ${tenantId} has low credit balance`, {
      tenantId,
      balance,
      threshold,
    }),

  highErrorRate: (service: string, rate: number, threshold: number) =>
    triggerAlert("high_error_rate", `High error rate in ${service}: ${rate}%`, {
      service,
      rate,
      threshold,
    }),

  deliveryRetryExceeded: (deliveryId: string, retryCount: number) =>
    triggerAlert("delivery_retry_exceeded", `Delivery ${deliveryId} exceeded retry limit`, {
      deliveryId,
      retryCount,
    }),

  chatwootSendFailed: (conversationId: string, error: string) =>
    triggerAlert("chatwoot_send_failed", `Failed to send message to Chatwoot conversation ${conversationId}`, {
      conversationId,
      error,
    }),

  openaiRateLimited: (model: string) =>
    triggerAlert("openai_rate_limited", `OpenAI rate limit hit for model ${model}`, {
      model,
    }),

  // Info (P2)
  newTenantRegistered: (tenantId: string, tenantName: string) =>
    triggerAlert("new_tenant_registered", `New tenant registered: ${tenantName}`, {
      tenantId,
      tenantName,
    }),

  largeCreditPurchase: (tenantId: string, amount: number) =>
    triggerAlert("large_credit_purchase", `Large credit purchase: ${amount} credits`, {
      tenantId,
      amount,
    }),
};

export default Alerts;




