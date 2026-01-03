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
    // 1. Check authentication
    console.log("🔍 Checking authentication...");
    const authTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout: Auth check tardó más de 10 segundos")), 10000);
    });

    const authResult = await Promise.race([
      supabase.auth.getUser(),
      authTimeoutPromise,
    ]) as any;

    if (authResult.error) {
      result.error = `Auth error: ${authResult.error.message}`;
      console.error("❌ Auth check failed:", authResult.error);
      return result;
    }

    result.authenticated = !!(authResult.data?.user);
    console.log(`✅ Auth check: ${result.authenticated ? "Authenticated" : "Not authenticated"}`);

    // 2. Check database connection with a simple query
    console.log("🔍 Checking database connection...");
    const { error: dbError } = await queryWithTimeout(
      supabase.from("tenants").select("id").limit(1),
      10000,
      "database health check",
      false // Don't retry health check
    );

    if (dbError) {
      result.error = `Database error: ${dbError.message} (${dbError.code})`;
      console.error("❌ Database check failed:", dbError);
      return result;
    }

    result.database = true;
    result.connected = true;
    console.log("✅ Database check: Connected");

    return result;
  } catch (error: any) {
    result.error = `Health check error: ${error?.message || "Unknown error"}`;
    console.error("❌ Health check failed:", error);
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











