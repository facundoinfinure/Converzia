/**
 * Sentry utilities for error tracking
 * Helpers to capture errors across the application
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Capture an exception with Sentry
 */
export function captureException(error: Error | unknown, context?: Record<string, any>) {
  if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV) {
    console.error('Error captured (Sentry disabled in dev):', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
  if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV) {
    console.log(`[${level.toUpperCase()}] ${message}`, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
}) {
  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Wrap async function with error capture
 */
export function withErrorCapture<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error, {
        ...context,
        args: args.map((arg) => {
          // Sanitize args before sending to Sentry
          if (typeof arg === 'object' && arg !== null) {
            const sanitized = { ...arg };
            const sensitiveKeys = ['password', 'token', 'secret', 'apiKey'];
            sensitiveKeys.forEach((key) => {
              if (key in sanitized) {
                sanitized[key] = '[REDACTED]';
              }
            });
            return sanitized;
          }
          return arg;
        }),
      });
      throw error;
    }
  }) as T;
}
