// ============================================
// API Route Wrapper
// Wraps API route handlers with error handling, Sentry, and logging
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, apiSuccess, ErrorCode } from "./api-error-handler";
import { logger } from "@/lib/utils/logger";
import * as Sentry from "@sentry/nextjs";
import { captureException } from "@/lib/utils/sentry";

type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

interface ApiWrapperOptions {
  /**
   * Whether to require authentication (default: true)
   */
  requireAuth?: boolean;
  
  /**
   * Whether to log request/response (default: true)
   */
  logRequests?: boolean;
  
  /**
   * Custom error handler
   */
  onError?: (error: unknown, request: NextRequest) => NextResponse | null;
  
  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;
}

/**
 * Wraps an API route handler with error handling, Sentry, and logging
 * 
 * @example
 * export const GET = withApiHandler(async (request) => {
 *   // Your handler logic
 *   return apiSuccess({ data: result });
 * });
 */
export function withApiHandler(
  handler: ApiHandler,
  options: ApiWrapperOptions = {}
): ApiHandler {
  const {
    requireAuth = true,
    logRequests = true,
    onError,
    timeout = 30000,
  } = options;

  return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Add request ID to Sentry context
    Sentry.setTag('request_id', requestId);
    
    // Add breadcrumb for request
    Sentry.addBreadcrumb({
      message: `${request.method} ${request.nextUrl.pathname}`,
      data: {
        method: request.method,
        path: request.nextUrl.pathname,
        searchParams: Object.fromEntries(request.nextUrl.searchParams),
      },
      level: 'info',
      timestamp: Date.now() / 1000,
    });

    if (logRequests) {
      logger.info("API Request", {
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        searchParams: Object.fromEntries(request.nextUrl.searchParams),
      });
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<NextResponse>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      });

      // Race handler against timeout
      const response = await Promise.race([
        handler(request, context),
        timeoutPromise,
      ]);

      const duration = Date.now() - startTime;

      if (logRequests) {
        logger.info("API Response", {
          method: request.method,
          path: request.nextUrl.pathname,
          status: response.status,
          duration,
          requestId,
        });
      }

      // Add response headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Response-Time', `${duration}ms`);

      return response;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      // Call custom error handler if provided
      if (onError) {
        const customResponse = onError(error, request);
        if (customResponse) {
          return customResponse;
        }
      }

      // Log error
      logger.exception("API Error", error, {
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        duration,
      });

      // Send to Sentry
      captureException(error, {
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        duration,
      });

      // Handle timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        return handleApiError(error, {
          code: ErrorCode.TIMEOUT,
          status: 504,
          message: 'Request timeout',
          context: {
            method: request.method,
            path: request.nextUrl.pathname,
            timeout,
          },
        });
      }

      // Handle other errors
      return handleApiError(error, {
        context: {
          method: request.method,
          path: request.nextUrl.pathname,
          requestId,
        },
      });
    }
  };
}
