import type { PostgrestError } from "@supabase/supabase-js";
import { retryQuery } from "./retry";

type SupabaseResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
};

/**
 * Helper function to add timeout and retry logic to Supabase queries
 * Prevents queries from hanging indefinitely and retries on failure
 */
export async function queryWithTimeout<T>(
  queryPromise: PromiseLike<SupabaseResponse<T>>,
  timeoutMs: number = 15000, // Reduced default from 20000 to 15000
  queryName: string = "query",
  enableRetry: boolean = true
): Promise<SupabaseResponse<T>> {
  const timeoutPromise = new Promise<SupabaseResponse<T>>((resolve) => {
    setTimeout(() => {
      resolve({
        data: null,
        count: null,
        error: {
          message: `Timeout: ${queryName} tardó más de ${timeoutMs}ms`,
          details: `La consulta ${queryName} no respondió en el tiempo esperado`,
          hint: "Verificá tu conexión a internet o intentá recargar la página",
          code: "TIMEOUT",
        } as PostgrestError,
      });
    }, timeoutMs);
  });

  const queryWithTimeoutFn = async (): Promise<SupabaseResponse<T>> => {
    try {
      const result = await Promise.race([queryPromise, timeoutPromise]);
      // Only log errors if they're not timeouts (timeouts are expected sometimes)
      if (result.error && result.error.code !== "TIMEOUT") {
        console.warn(`⚠️ Query error in ${queryName}:`, result.error.message);
      }
      return result;
    } catch (error: any) {
      // Only log non-timeout errors
      if (!error?.message?.includes("Timeout") && !error?.code?.includes("TIMEOUT")) {
        console.error(`❌ Error in ${queryName}:`, error);
      }
      return {
        data: null,
        count: null,
        error: {
          message: error?.message || "Error desconocido",
          code: error?.code || "UNKNOWN",
        } as PostgrestError,
      };
    }
  };

  // Apply retry logic if enabled
  // Note: TIMEOUT errors are NOT retried (handled in retry.ts)
  // Retrying timeouts just wastes time since they indicate slow queries, not transient errors
  if (enableRetry) {
    return retryQuery(queryWithTimeoutFn, {
      maxRetries: 1, // Reduced from 2 to 1 - most queries should succeed on first retry if it's a transient error
      retryDelay: 500, // Start with 500ms delay
    });
  }

  return queryWithTimeoutFn();
}

/**
 * Helper function to add timeout and retry logic to Supabase RPC calls
 * Prevents RPC calls from hanging indefinitely and retries on failure
 * RPC calls are critical for the lead pipeline, so they need timeout protection
 * According to AGENTS.md section 7, all external integrations must implement timeouts
 */
export async function rpcWithTimeout<T>(
  rpcPromise: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  timeoutMs: number = 20000,
  rpcName: string = "RPC call",
  enableRetry: boolean = true
): Promise<{ data: T | null; error: PostgrestError | null }> {
  const timeoutPromise = new Promise<SupabaseResponse<T>>((resolve) => {
    setTimeout(() => {
      resolve({
        data: null,
        count: null,
        error: {
          message: `Timeout: ${rpcName} tardó más de ${timeoutMs}ms`,
          details: `La llamada RPC ${rpcName} no respondió en el tiempo esperado`,
          hint: "Verificá tu conexión a internet o intentá recargar la página",
          code: "TIMEOUT",
        } as PostgrestError,
      });
    }, timeoutMs);
  });

  const rpcWithTimeoutFn = async (): Promise<SupabaseResponse<T>> => {
    try {
      const result = await Promise.race([rpcPromise, timeoutPromise]);
      // Convert RPC result to SupabaseResponse format (RPC doesn't have count)
      return {
        data: result.data,
        count: null,
        error: result.error,
      };
    } catch (error: any) {
      console.error(`❌ Error in ${rpcName}:`, error);
      return {
        data: null,
        count: null,
        error: {
          message: error?.message || "Error desconocido",
          code: error?.code || "UNKNOWN",
        } as PostgrestError,
      };
    }
  };

  // Apply retry logic if enabled
  // Note: TIMEOUT errors are NOT retried (handled in retry.ts)
  if (enableRetry) {
    const result = await retryQuery(rpcWithTimeoutFn, {
      maxRetries: 1, // Reduced from 2 to 1 - RPC calls should succeed on first retry if transient
      retryDelay: 500, // Start with 500ms delay
    });
    // Return RPC format (without count)
    return {
      data: result.data,
      error: result.error,
    };
  }

  const result = await rpcWithTimeoutFn();
  // Return RPC format (without count)
  return {
    data: result.data,
    error: result.error,
  };
}













