"use client";

import type { PostgrestSingleResponse, PostgrestError } from "@supabase/supabase-js";

/**
 * Helper function to add timeout to Supabase queries
 * Prevents queries from hanging indefinitely
 */
export async function queryWithTimeout<T>(
  queryPromise: Promise<{ data: T | null; error: PostgrestError | null }>,
  timeoutMs: number = 10000,
  queryName: string = "query"
): Promise<{ data: T | null; error: PostgrestError | null }> {
  const timeoutPromise = new Promise<{ data: null; error: PostgrestError }>((resolve) => {
    setTimeout(() => {
      resolve({
        data: null,
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
      error: {
        message: error?.message || "Error desconocido",
        code: error?.code || "UNKNOWN",
      } as PostgrestError,
    };
  }
}
