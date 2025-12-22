// ============================================
// Environment Variables Validation
// Ensures all required security-critical env vars are configured
// ============================================

/**
 * Required environment variables for production
 * Missing any of these will cause the app to fail at startup
 */
const REQUIRED_ENV_VARS = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: "Supabase project URL",
  
  // Stripe (payments)
  STRIPE_SECRET_KEY: "Stripe secret API key for server-side operations",
  STRIPE_WEBHOOK_SECRET: "Stripe webhook signing secret for signature validation",
  
  // Meta/Facebook (lead ads)
  META_APP_SECRET: "Meta app secret for webhook signature validation",
  META_WEBHOOK_VERIFY_TOKEN: "Meta webhook verification token",
  
  // Chatwoot (messaging)
  CHATWOOT_WEBHOOK_SECRET: "Chatwoot webhook secret for signature validation",
  
  // Cron jobs
  CRON_SECRET: "Secret for authenticating Vercel cron job requests",
} as const;

/**
 * Optional but recommended for production
 */
const RECOMMENDED_ENV_VARS = {
  // Rate limiting (falls back to in-memory if not set)
  UPSTASH_REDIS_REST_URL: "Upstash Redis REST URL for distributed rate limiting",
  UPSTASH_REDIS_REST_TOKEN: "Upstash Redis REST token",
  
  // PII encryption
  PII_ENCRYPTION_KEY: "32-byte hex key for AES-256-GCM encryption of sensitive data",
} as const;

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validates that all required environment variables are set
 * Should be called at app startup
 */
export function validateRequiredEnvVars(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required vars
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    if (!process.env[key]) {
      missing.push(`${key}: ${description}`);
    }
  }
  
  // Check recommended vars
  for (const [key, description] of Object.entries(RECOMMENDED_ENV_VARS)) {
    if (!process.env[key]) {
      warnings.push(`${key}: ${description}`);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Throws an error if any required environment variables are missing
 * Use this in production startup
 */
export function assertEnvVars(): void {
  const result = validateRequiredEnvVars();
  
  if (!result.valid) {
    const errorMessage = [
      "SECURITY ERROR: Missing required environment variables:",
      "",
      ...result.missing.map(m => `  - ${m}`),
      "",
      "The application cannot start without these variables.",
      "Please configure them in your Vercel project settings or .env.local file.",
    ].join("\n");
    
    throw new Error(errorMessage);
  }
  
  if (result.warnings.length > 0) {
    console.warn(
      "[Security] Recommended environment variables not set:\n" +
      result.warnings.map(w => `  - ${w}`).join("\n")
    );
  }
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Get a required environment variable, throwing if not set
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default value
 */
export function getOptionalEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] || defaultValue;
}

/**
 * Check if a specific security feature is enabled
 */
export function isSecurityFeatureEnabled(feature: "redis" | "pii_encryption"): boolean {
  switch (feature) {
    case "redis":
      return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    case "pii_encryption":
      return !!process.env.PII_ENCRYPTION_KEY;
    default:
      return false;
  }
}

