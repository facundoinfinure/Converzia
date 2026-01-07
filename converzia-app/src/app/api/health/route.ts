import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRedisHealth } from "@/lib/security/rate-limit";
import { validateRequiredEnvVars } from "@/lib/security/env-validation";

// ============================================
// Health Check Endpoint
// ============================================

export const dynamic = "force-dynamic";

export async function GET() {
  const health: {
    status: string;
    timestamp: string;
    version?: string;
    services: {
      database: "connected" | "disconnected" | "error";
      redis: "connected" | "disconnected" | "not_configured";
      openai: "configured" | "not_configured" | "error";
      resend: "configured" | "not_configured";
      chatwoot: "configured" | "not_configured";
      meta: "configured" | "not_configured";
      stripe: "configured" | "not_configured";
    };
    env?: {
      valid: boolean;
      missing?: string[];
      warnings?: string[];
    };
    errors?: string[];
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "disconnected",
      redis: "not_configured",
      openai: "not_configured",
      resend: "not_configured",
      chatwoot: "not_configured",
      meta: "not_configured",
      stripe: "not_configured",
    },
  };

  const errors: string[] = [];

  // Validate environment variables
  try {
    const envValidation = validateRequiredEnvVars();
    health.env = {
      valid: envValidation.valid,
      missing: envValidation.missing,
      warnings: envValidation.warnings,
    };
    if (!envValidation.valid) {
      errors.push("Missing required environment variables");
    }
  } catch (error) {
    errors.push(`Env validation error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  // Check database
  try {
    const supabase = createAdminClient();
    const { queryWithTimeout } = await import("@/lib/supabase/query-with-timeout");
    const { error } = await queryWithTimeout(
      supabase.from("tenants").select("id").limit(1),
      5000,
      "health check database"
    );
    
    if (error) {
      health.services.database = "error";
      errors.push(`Database error: ${error.message}`);
    } else {
      health.services.database = "connected";
    }
  } catch (error) {
    health.services.database = "disconnected";
    errors.push(`Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Check Redis
  try {
    const redisHealthy = await checkRedisHealth();
    if (redisHealthy) {
      health.services.redis = "connected";
    } else {
      health.services.redis = "disconnected";
      errors.push("Redis connection failed");
    }
  } catch (error) {
    health.services.redis = "not_configured";
  }

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      // Optionally test the API key by making a lightweight request
      health.services.openai = "configured";
    } catch (error) {
      health.services.openai = "error";
      errors.push("OpenAI API key configured but validation failed");
    }
  } else {
    health.services.openai = "not_configured";
    errors.push("OpenAI API key not configured");
  }

  // Check Resend
  health.services.resend = process.env.RESEND_API_KEY ? "configured" : "not_configured";

  // Check Chatwoot
  health.services.chatwoot = (process.env.CHATWOOT_API_URL && process.env.CHATWOOT_API_TOKEN)
    ? "configured"
    : "not_configured";

  // Check Meta/Facebook
  health.services.meta = (process.env.META_APP_SECRET && process.env.META_WEBHOOK_VERIFY_TOKEN)
    ? "configured"
    : "not_configured";

  // Check Stripe
  health.services.stripe = process.env.STRIPE_SECRET_KEY ? "configured" : "not_configured";

  // Set overall status
  if (errors.length > 0 || health.services.database !== "connected") {
    health.status = "degraded";
  }

  health.errors = errors.length > 0 ? errors : undefined;

  // Add version if available
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    health.version = process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7);
  }

  const statusCode = health.status === "ok" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

