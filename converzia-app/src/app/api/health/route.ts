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
      openai?: "configured" | "not_configured";
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
    const { error } = await supabase.from("tenants").select("id").limit(1);
    
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

  // Check OpenAI (optional)
  if (process.env.OPENAI_API_KEY) {
    health.services.openai = "configured";
  } else {
    health.services.openai = "not_configured";
  }

  // Set overall status
  if (errors.length > 0 || health.services.database !== "connected") {
    health.status = "degraded";
  }

  // Add version if available
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    health.version = process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7);
  }

  const statusCode = health.status === "ok" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}

