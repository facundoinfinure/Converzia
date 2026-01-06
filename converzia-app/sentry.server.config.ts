/**
 * Sentry Server Configuration
 * Error tracking and performance monitoring for server-side
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Server-side integrations
  integrations: [
    Sentry.httpIntegration(),
  ],

  // Filter sensitive data
  beforeSend(event, hint) {
    // Don't send in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV) {
      return null;
    }

    // Filter env vars that might be logged
    if (event.extra) {
      const sensitiveKeys = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY',
        'META_APP_SECRET',
        'RESEND_API_KEY',
        'DATABASE_URL',
      ];

      sensitiveKeys.forEach((key) => {
        if (event.extra && key in event.extra) {
          event.extra[key] = '[REDACTED]';
        }
      });
    }

    return event;
  },

  // Ignore errors
  ignoreErrors: [
    // Supabase auth errors that are expected
    'AuthApiError',
    'AuthRetryableFetchError',
  ],
});
