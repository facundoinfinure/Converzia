/**
 * Reusable pagination hook
 * Eliminates duplicated pagination logic across the app
 */

import { useState, useMemo, useCallback } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

interface UsePaginationResult {
  page: number;
  pageSize: number;
  from: number;
  to: number;
  range: { from: number; to: number };
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: (totalItems: number) => void;
  canGoNext: (totalItems: number) => boolean;
  canGoPrevious: boolean;
  totalPages: (totalItems: number) => number;
  reset: () => void;
}

/**
 * Custom hook for managing pagination state
 *
 * @example
 * const { page, pageSize, range, setPage, setPageSize } = usePagination({
 *   initialPage: 1,
 *   initialPageSize: 20
 * });
 *
 * // Use in Supabase query
 * query.range(range.from, range.to);
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationResult {
  const {
    initialPage = 1,
    initialPageSize = 20,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Calculate range for Supabase queries
  const range = useMemo(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  }, [page, pageSize]);

  // Individual from/to values for convenience
  const from = range.from;
  const to = range.to;

  // Navigation functions
  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const previousPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToFirstPage = useCallback(() => {
    setPage(1);
  }, []);

  const goToLastPage = useCallback((totalItems: number) => {
    const lastPage = Math.ceil(totalItems / pageSize);
    setPage(lastPage);
  }, [pageSize]);

  // Check if navigation is possible
  const canGoPrevious = page > 1;

  const canGoNext = useCallback((totalItems: number) => {
    const lastPage = Math.ceil(totalItems / pageSize);
    return page < lastPage;
  }, [page, pageSize]);

  // Calculate total pages
  const totalPages = useCallback((totalItems: number) => {
    return Math.ceil(totalItems / pageSize);
  }, [pageSize]);

  // Reset to initial state
  const reset = useCallback(() => {
    setPage(initialPage);
    setPageSize(initialPageSize);
  }, [initialPage, initialPageSize]);

  // When page size changes, reset to first page
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  }, []);

  return {
    page,
    pageSize,
    from,
    to,
    range,
    setPage,
    setPageSize: handlePageSizeChange,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    canGoNext,
    canGoPrevious,
    totalPages,
    reset,
  };
}
