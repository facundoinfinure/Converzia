"use client";

import { createClient } from "./client";
import { queryWithTimeout } from "./query-with-timeout";

/**
 * Health check result
 */
export interface HealthCheckResult {
  connected: boolean;
  authenticated: boolean;
  database: boolean;
  error: string | null;
  timestamp: number;
}

/**
 * Perform a comprehensive health check of Supabase connection
 */
export async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  const supabase = createClient();
  const result: HealthCheckResult = {
    connected: false,
    authenticated: false,
    database: false,
    error: null,
    timestamp: Date.now(),
  };

  try {
    // 1. Check authentication (with longer timeout and non-blocking)
    // Silently check auth - don't log unless there's a real issue
    const authTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout: Auth check tardó más de 15 segundos")), 15000);
    });

    const authResult = await Promise.race([
      supabase.auth.getUser(),
      authTimeoutPromise,
    ]) as any;

    if (authResult.error) {
      result.error = `Auth error: ${authResult.error.message}`;
      // Only log if it's not a timeout (timeouts are expected sometimes)
      if (!authResult.error.message?.includes("Timeout")) {
        console.warn("⚠️ Auth check failed (non-critical):", authResult.error);
      }
      // Don't return early, continue with database check
    } else {
      result.authenticated = !!(authResult.data?.user);
      // Don't log successful auth checks to reduce console noise
    }

    // 2. Check database connection with a simple query (non-blocking)
    // Silently check database - don't log unless there's a real issue
    const { error: dbError } = await queryWithTimeout(
      supabase.from("tenants").select("id").limit(1),
      15000,
      "database health check",
      false // Don't retry health check
    );

    if (dbError) {
      result.error = result.error || `Database error: ${dbError.message} (${dbError.code})`;
      // Only log if it's not a timeout (timeouts are expected sometimes)
      if (!dbError.message?.includes("Timeout")) {
        console.warn("⚠️ Database check failed (non-critical):", dbError);
      }
      // Still return result, don't block app initialization
    } else {
      result.database = true;
      result.connected = true;
      // Don't log successful database checks to reduce console noise
    }

    return result;
  } catch (error: any) {
    result.error = `Health check error: ${error?.message || "Unknown error"}`;
    // Only log if it's not a timeout (timeouts are expected sometimes)
    if (!error?.message?.includes("Timeout")) {
      console.warn("⚠️ Health check failed (non-critical):", error);
    }
    // Return result anyway, don't block app
    return result;
  }
}

/**
 * Monitor Supabase health periodically
 */
export class HealthMonitor {
  private interval: NodeJS.Timeout | null = null;
  private onHealthChange?: (result: HealthCheckResult) => void;

  start(intervalMs: number = 30000, onHealthChange?: (result: HealthCheckResult) => void): void {
    this.onHealthChange = onHealthChange;
    
    if (this.interval) {
      clearInterval(this.interval);
    }

    // Check immediately
    this.check();

    // Then check periodically
    this.interval = setInterval(() => {
      this.check();
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async check(): Promise<void> {
    const result = await checkSupabaseHealth();
    if (this.onHealthChange) {
      this.onHealthChange(result);
    }
  }
}

export const healthMonitor = new HealthMonitor();











