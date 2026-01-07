// ============================================
// API Response Types
// Standard types for all API responses
// ============================================

import type { ApiErrorResponse, ApiSuccessResponse } from "@/lib/utils/api-error-handler";

// Re-export for convenience
export type { ApiErrorResponse, ApiSuccessResponse } from "@/lib/utils/api-error-handler";

// ============================================
// Common Response Types
// ============================================

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * List response (non-paginated)
 */
export interface ListResponse<T> {
  items: T[];
  count: number;
}

/**
 * Single item response
 */
export interface ItemResponse<T> {
  item: T;
}

/**
 * Operation result
 */
export interface OperationResult {
  success: boolean;
  message?: string;
  id?: string;
}

// ============================================
// Type Guards
// ============================================

export function isApiError(
  response: ApiSuccessResponse | ApiErrorResponse
): response is ApiErrorResponse {
  return "error" in response;
}

export function isApiSuccess<T>(
  response: ApiSuccessResponse<T> | ApiErrorResponse
): response is ApiSuccessResponse<T> {
  return "success" in response && response.success === true;
}
