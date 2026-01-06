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
  queryPromise: Promise<SupabaseResponse<T>>,
  timeoutMs: number = 20000,
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
      return result;
    } catch (error: any) {
      console.error(`❌ Error in ${queryName}:`, error);
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
  if (enableRetry) {
    return retryQuery(queryWithTimeoutFn, {
      maxRetries: 2, // Retry up to 2 times (3 total attempts)
      retryDelay: 500, // Start with 500ms delay
    });
  }

  return queryWithTimeoutFn();
}













