import crypto from "crypto";

// ============================================
// Webhook Signature Validation
// ============================================

/**
 * Validates Chatwoot webhook signature
 * Chatwoot uses HMAC-SHA256 with the webhook secret
 */
export function validateChatwootSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn("Missing Chatwoot webhook signature or secret");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Chatwoot sends signature as plain hex
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("Chatwoot signature validation error:", error);
    return false;
  }
}

/**
 * Validates Meta (Facebook) webhook signature
 * Meta uses X-Hub-Signature-256 header with sha256=<signature>
 */
export function validateMetaSignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature || !appSecret) {
    console.warn("Missing Meta webhook signature or app secret");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex");

    // Meta sends signature as "sha256=<hex>"
    const signatureHash = signature.replace("sha256=", "");

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("Meta signature validation error:", error);
    return false;
  }
}

/**
 * Validates Stripe webhook signature
 * Uses Stripe's built-in verification via stripe.webhooks.constructEvent
 * This is a helper for manual verification if needed
 */
export function validateStripeSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn("Missing Stripe webhook signature or secret");
    return false;
  }

  try {
    // Stripe signature format: t=timestamp,v1=signature,v0=legacy_signature
    const elements = signature.split(",");
    const timestampElement = elements.find((e) => e.startsWith("t="));
    const signatureElement = elements.find((e) => e.startsWith("v1="));

    if (!timestampElement || !signatureElement) {
      return false;
    }

    const timestamp = timestampElement.replace("t=", "");
    const expectedSignature = signatureElement.replace("v1=", "");

    // Create signed payload
    const signedPayload = `${timestamp}.${payload}`;

    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    // Verify signature
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(expectedSignature)
    );

    // Also verify timestamp is recent (5 min tolerance)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    const isTimestampValid = timestampAge < 300; // 5 minutes

    return isValid && isTimestampValid;
  } catch (error) {
    console.error("Stripe signature validation error:", error);
    return false;
  }
}

/**
 * Generic HMAC validation for custom webhooks
 */
export function validateHmacSignature(
  payload: string,
  signature: string | null,
  secret: string,
  algorithm: "sha256" | "sha512" = "sha256",
  prefix: string = ""
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest("hex");

    const signatureHash = signature.replace(prefix, "");

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("HMAC validation error:", error);
    return false;
  }
}

// ============================================
// Request Sanitization
// ============================================

/**
 * Sanitize log data to remove PII
 */
export function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    "phone",
    "phone_number",
    "email",
    "password",
    "api_key",
    "secret",
    "token",
    "authorization",
    "credit_card",
    "card_number",
    "cvv",
    "ssn",
    "dni",
    "cuit",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Mask phone number for display
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-3);
}

/**
 * Mask email for display
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const maskedLocal = local.slice(0, 2) + "***";
  return `${maskedLocal}@${domain}`;
}


