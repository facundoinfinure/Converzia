/**
 * Sentry Client Configuration
 * Error tracking and performance monitoring for browser
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production, or using tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replay Configuration
  replaysOnErrorSampleRate: 1.0, // 100% of errors will have replay

  // Session Replay sample rate for normal sessions
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV) {
      return null;
    }

    // Filter out sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }

    // Filter out sensitive query params
    if (event.request?.query_string && typeof event.request.query_string === 'string') {
      let queryString = event.request.query_string;
      const sensitiveParams = ['token', 'api_key', 'password'];
      sensitiveParams.forEach((param) => {
        if (queryString.includes(param)) {
          queryString = queryString.replace(
            new RegExp(`${param}=[^&]+`, 'g'),
            `${param}=[REDACTED]`
          );
        }
      });
      event.request.query_string = queryString;
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    // Facebook borked
    'fb_xd_fragment',
    // ISP optimizing proxy
    'bmi_SafeAddOnload',
    'EBCallBackMessageReceived',
    // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
    'Can\'t find variable: ZiteReader',
    'jigsaw is not defined',
    'ComboSearch is not defined',
    // Common network errors
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    // ResizeObserver loop errors (benign)
    'ResizeObserver loop',
  ],
});
