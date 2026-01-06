/**
 * Sentry Edge Configuration
 * Error tracking for Edge Runtime (Middleware, Edge API Routes)
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  debug: false,

  environment: process.env.NODE_ENV,

  release: process.env.VERCEL_GIT_COMMIT_SHA,
});
