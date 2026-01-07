// ============================================
// Webhook Retry Logic with Exponential Backoff
// ============================================

import { logger } from "@/lib/utils/logger";

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors (4xx client errors except 429)
      if (error instanceof Error && "status" in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500 && status !== 429) {
          throw error; // Don't retry client errors
        }
      }

      // If this was the last attempt, throw
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Log webhook retry attempt
 */
export function logWebhookRetry(
  webhookType: string,
  attempt: number,
  maxRetries: number,
  error: Error | unknown
): void {
  logger.warn(`[Webhook Retry] ${webhookType} - Attempt ${attempt}/${maxRetries}`, error instanceof Error ? error : new Error(String(error)), {
    webhookType,
    attempt,
    maxRetries,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log webhook success after retries
 */
export function logWebhookSuccess(
  webhookType: string,
  attempt: number
): void {
  if (attempt > 1) {
    logger.info(`[Webhook Success] ${webhookType} - Succeeded after ${attempt} attempts`, {
      webhookType,
      attempt,
    });
  }
}

