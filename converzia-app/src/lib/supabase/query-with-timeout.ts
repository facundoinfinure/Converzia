"use client";

import type { PostgrestError } from "@supabase/supabase-js";

type SupabaseResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
};

/**
 * Helper function to add timeout to Supabase queries
 * Prevents queries from hanging indefinitely
 */
export async function queryWithTimeout<T>(
  queryPromise: Promise<SupabaseResponse<T>>,
  timeoutMs: number = 10000,
  queryName: string = "query"
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
}
