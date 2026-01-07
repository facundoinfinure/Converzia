/**
 * Sentry utilities for error tracking
 * Helpers to capture errors across the application
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Capture an exception with Sentry
 * Enhanced with better context and breadcrumbs
 */
export function captureException(error: Error | unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV) {
    console.error('Error captured (Sentry disabled in dev):', error, context);
    return;
  }

  // Add breadcrumb before capturing
  if (context) {
    Sentry.addBreadcrumb({
      message: 'Error context',
      data: context,
      level: 'error',
      timestamp: Date.now() / 1000,
    });
  }

  Sentry.captureException(error, {
    extra: context,
    tags: {
      source: 'application',
    },
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
 * Enhanced with tenant context
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
  tenantId?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });

  // Set tenant as tag for filtering
  if (user.tenantId) {
    Sentry.setTag('tenant_id', user.tenantId);
  }
}

/**
 * Clear user context
 */
export function clearUser() {
  Sentry.setUser(null);
  Sentry.setTag('tenant_id', undefined);
}

/**
 * Set tenant context for error tracking
 */
export function setTenantContext(tenantId: string, tenantName?: string) {
  Sentry.setTag('tenant_id', tenantId);
  if (tenantName) {
    Sentry.setContext('tenant', {
      id: tenantId,
      name: tenantName,
    });
  }
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
