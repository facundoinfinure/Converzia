// ============================================
// Standard API Error Handler
// Provides consistent error handling for all API routes
// ============================================

import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import * as Sentry from "@sentry/nextjs";

// ============================================
// Error Response Types
// ============================================

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// Error Codes
// ============================================

export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  
  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  
  // Not Found
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  
  // Conflict
  CONFLICT = "CONFLICT",
  DUPLICATE = "DUPLICATE",
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  
  // Server Errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
  TIMEOUT = "TIMEOUT",
  
  // Business Logic
  INSUFFICIENT_CREDITS = "INSUFFICIENT_CREDITS",
  INVALID_STATE = "INVALID_STATE",
}

// ============================================
// Error Handler Function
// ============================================

interface ErrorHandlerOptions {
  /**
   * Whether to log the error (default: true)
   */
  logError?: boolean;
  
  /**
   * Whether to send to Sentry (default: true in production)
   */
  sendToSentry?: boolean;
  
  /**
   * Custom error message (overrides default)
   */
  message?: string;
  
  /**
   * Error code (default: INTERNAL_ERROR)
   */
  code?: ErrorCode;
  
  /**
   * Additional context for logging
   */
  context?: Record<string, unknown>;
  
  /**
   * HTTP status code (default: 500)
   */
  status?: number;
  
  /**
   * Whether to expose internal error details (default: false in production)
   */
  exposeDetails?: boolean;
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Standard error handler for API routes
 * 
 * @example
 * try {
 *   // ... API logic
 * } catch (error) {
 *   return handleApiError(error, { code: ErrorCode.VALIDATION_ERROR, status: 400 });
 * }
 */
export function handleApiError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): NextResponse<ApiErrorResponse> {
  const {
    logError = true,
    sendToSentry = isProduction,
    message,
    code = ErrorCode.INTERNAL_ERROR,
    context = {},
    status = 500,
    exposeDetails = !isProduction,
  } = options;

  // Extract error information
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const errorStack = error instanceof Error ? error.stack : undefined;
  const finalMessage = message || (exposeDetails ? errorMessage : "An error occurred");

  // Generate request ID for tracing
  const requestId = crypto.randomUUID();

  // Prepare error response
  const errorResponse: ApiErrorResponse = {
    error: finalMessage,
    code,
    request_id: requestId,
  };

  // Add details in development
  if (exposeDetails && error instanceof Error) {
    errorResponse.details = {
      message: error.message,
      name: error.name,
    };
  }

  // Log error
  if (logError) {
    logger.exception("API Error", error, {
      ...context,
      code,
      requestId,
      status,
    });
  }

  // Send to Sentry
  if (sendToSentry && error instanceof Error) {
    Sentry.captureException(error, {
      tags: {
        error_code: code,
        request_id: requestId,
      },
      extra: {
        ...context,
        status,
      },
    });
  }

  return NextResponse.json(errorResponse, { status });
}

// ============================================
// Success Response Helper
// ============================================

/**
 * Standard success response helper
 * 
 * @example
 * return apiSuccess({ data: result, message: "Operation completed" });
 */
export function apiSuccess<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status });
}

// ============================================
// Common Error Handlers
// ============================================

/**
 * Handle validation errors
 */
export function handleValidationError(
  error: unknown,
  context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return handleApiError(error, {
    code: ErrorCode.VALIDATION_ERROR,
    status: 400,
    message: "Validation error",
    context,
  });
}

/**
 * Handle unauthorized errors
 */
export function handleUnauthorized(
  message: string = "Unauthorized"
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    code: ErrorCode.UNAUTHORIZED,
    status: 401,
    message,
    logError: false, // Don't log auth failures
    sendToSentry: false,
  });
}

/**
 * Handle forbidden errors
 */
export function handleForbidden(
  message: string = "Forbidden"
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    code: ErrorCode.FORBIDDEN,
    status: 403,
    message,
    logError: false,
    sendToSentry: false,
  });
}

/**
 * Handle not found errors
 */
export function handleNotFound(
  resource: string = "Resource",
  context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(`${resource} not found`), {
    code: ErrorCode.NOT_FOUND,
    status: 404,
    message: `${resource} not found`,
    context,
    logError: false,
    sendToSentry: false,
  });
}

/**
 * Handle conflict errors (e.g., duplicate)
 */
export function handleConflict(
  message: string,
  context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    code: ErrorCode.CONFLICT,
    status: 409,
    message,
    context,
  });
}

/**
 * Handle rate limit errors
 */
export function handleRateLimit(
  message: string = "Rate limit exceeded"
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(message), {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    status: 429,
    message,
    logError: false,
    sendToSentry: false,
  });
}

/**
 * Handle timeout errors
 */
export function handleTimeout(
  operation: string,
  context?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return handleApiError(new Error(`Operation timed out: ${operation}`), {
    code: ErrorCode.TIMEOUT,
    status: 504,
    message: "Request timeout",
    context: { operation, ...context },
  });
}
