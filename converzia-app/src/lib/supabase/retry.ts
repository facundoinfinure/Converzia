import type { PostgrestError } from "@supabase/supabase-js";

type SupabaseResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
};

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  retryableErrors: [
    "TIMEOUT",
    "PGRST301", // Connection error
    "PGRST116", // Not found (sometimes transient)
    "network",
  ],
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: PostgrestError | null, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  const errorCode = error.code || "";
  const errorMessage = (error.message || "").toLowerCase();
  
  return retryableErrors.some(
    (retryable) =>
      errorCode.includes(retryable) ||
      errorMessage.includes(retryable) ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("network")
  );
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a Supabase query with exponential backoff
 */
export async function retryQuery<T>(
  queryFn: () => Promise<SupabaseResponse<T>>,
  config: RetryConfig = {}
): Promise<SupabaseResponse<T>> {
  const { maxRetries, retryDelay, retryableErrors } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: PostgrestError | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = await queryFn();

      // If successful or non-retryable error, return immediately
      if (!result.error || !isRetryableError(result.error, retryableErrors)) {
        if (attempt > 0) {
          console.log(`✅ Query succeeded after ${attempt} retry(ies)`);
        }
        return result;
      }

      lastError = result.error;

      // If this was the last attempt, return the error
      if (attempt >= maxRetries) {
        console.error(`❌ Query failed after ${attempt} retries:`, lastError);
        return result;
      }

      // Calculate exponential backoff delay
      const delay = retryDelay * Math.pow(2, attempt);
      // Only log warnings for critical queries or after first retry
      if (attempt >= 1) {
        console.warn(
          `⚠️ Query failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
          lastError?.message
        );
      }

      await sleep(delay);
      attempt++;
    } catch (error: any) {
      lastError = {
        message: error?.message || "Unknown error",
        code: error?.code || "UNKNOWN",
      } as PostgrestError;

      if (attempt >= maxRetries) {
        console.error(`❌ Query threw exception after ${attempt} retries:`, error);
        return {
          data: null,
          count: null,
          error: lastError,
        };
      }

      const delay = retryDelay * Math.pow(2, attempt);
      // Only log warnings for critical queries or after first retry
      if (attempt >= 1) {
        console.warn(
          `⚠️ Query exception (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
          error?.message
        );
      }

      await sleep(delay);
      attempt++;
    }
  }

  return {
    data: null,
    count: null,
    error: lastError,
  };
}












