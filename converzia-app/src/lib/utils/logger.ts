/**
 * Structured logging utility
 * Replaces console.log to prevent sensitive data exposure in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Sanitize objects to prevent logging sensitive data
 */
function sanitizeForLogging(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeForLogging);
  }

  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'api_key',
    'secret',
    'authorization',
    'cookie',
    'dni',
    'ssn',
    'credit_card',
    'card_number',
  ];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive information
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Format log message with metadata
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(sanitizeForLogging(context))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

/**
 * Send logs to external service in production (Sentry, Datadog, etc.)
 */
function sendToExternalService(level: LogLevel, message: string, context?: LogContext): void {
  // Send to Sentry
  if (isProduction && typeof window === 'undefined') {
    // Server-side
    import('@sentry/nextjs').then((Sentry) => {
      if (level === 'error') {
        Sentry.captureMessage(message, {
          level: 'error',
          extra: context,
        });
      } else if (level === 'warn') {
        Sentry.captureMessage(message, {
          level: 'warning',
          extra: context,
        });
      }
    });
  }

  // Also console log in production for critical errors
  if (isProduction && level === 'error') {
    console.error(formatLog(level, message, context));
  }
}

/**
 * Logger class with structured logging methods
 */
class Logger {
  private context: LogContext;

  constructor(defaultContext: LogContext = {}) {
    this.context = defaultContext;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Debug-level logging (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (isDevelopment) {
      const mergedContext = { ...this.context, ...context };
      console.debug(formatLog('debug', message, mergedContext));
    }
  }

  /**
   * Info-level logging
   */
  info(message: string, context?: LogContext): void {
    const mergedContext = { ...this.context, ...context };

    if (isDevelopment) {
      console.info(formatLog('info', message, mergedContext));
    }

    sendToExternalService('info', message, mergedContext);
  }

  /**
   * Warning-level logging
   */
  warn(message: string, context?: LogContext): void {
    const mergedContext = { ...this.context, ...context };

    if (isDevelopment) {
      console.warn(formatLog('warn', message, mergedContext));
    }

    sendToExternalService('warn', message, mergedContext);
  }

  /**
   * Error-level logging (always logged)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const mergedContext = {
      ...this.context,
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };

    // Always log errors, even in production
    console.error(formatLog('error', message, mergedContext));

    sendToExternalService('error', message, mergedContext);
  }

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case 'debug':
        this.debug(message, context);
        break;
      case 'info':
        this.info(message, context);
        break;
      case 'warn':
        this.warn(message, context);
        break;
      case 'error':
        this.error(message, undefined, context);
        break;
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Export utilities
export { Logger, sanitizeForLogging };
export type { LogLevel, LogContext };
