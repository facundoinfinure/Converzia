"use client";

import { createClient } from "./client";

/**
 * Diagnostic function to check Supabase connection and authentication
 * Useful for debugging connection issues
 */
export async function diagnoseSupabaseConnection() {
  const supabase = createClient();
  const diagnostics: {
    connected: boolean;
    authenticated: boolean;
    user: any;
    error: string | null;
    cookies: string[];
  } = {
    connected: false,
    authenticated: false,
    user: null,
    error: null,
    cookies: [],
  };

  try {
    // Check if we can reach Supabase
    const { data: healthCheck, error: healthError } = await supabase
      .from("tenants")
      .select("id")
      .limit(1);

    if (healthError) {
      diagnostics.error = `Health check failed: ${healthError.message} (${healthError.code})`;
      console.error("Supabase health check error:", healthError);
    } else {
      diagnostics.connected = true;
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      diagnostics.error = `Auth check failed: ${authError.message}`;
      console.error("Supabase auth error:", authError);
    } else if (user) {
      diagnostics.authenticated = true;
      diagnostics.user = {
        id: user.id,
        email: user.email,
      };
    }

    // Check cookies (browser only)
    if (typeof document !== "undefined") {
      diagnostics.cookies = document.cookie.split("; ").map((c) => c.split("=")[0]);
    }

    return diagnostics;
  } catch (error: any) {
    diagnostics.error = `Unexpected error: ${error?.message || "Unknown error"}`;
    console.error("Diagnostics error:", error);
    return diagnostics;
  }
}











