"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface UseCachedDataOptions<T> {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean;
  fetcher: () => Promise<T>;
  enabled?: boolean;
}

/**
 * useCachedData - Hook para cache inteligente con TTL
 * Implementa stale-while-revalidate pattern
 */
export function useCachedData<T>(
  key: string,
  options: UseCachedDataOptions<T>
) {
  const {
    ttl = 30000, // 30 seconds default
    staleWhileRevalidate = true,
    fetcher,
    enabled = true,
  } = options;

  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getCachedData = useCallback((): T | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired && !staleWhileRevalidate) {
      cacheRef.current.delete(key);
      return null;
    }

    return entry.data;
  }, [key, staleWhileRevalidate]);

  const setCachedData = useCallback(
    (newData: T) => {
      const entry: CacheEntry<T> = {
        data: newData,
        timestamp: Date.now(),
        ttl,
      };
      cacheRef.current.set(key, entry);
      setData(newData);
    },
    [key, ttl]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setCachedData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, setCachedData]);

  useEffect(() => {
    if (!enabled) return;

    const cached = getCachedData();
    if (cached) {
      setData(cached);
      // Revalidate in background if stale
      const entry = cacheRef.current.get(key);
      if (entry) {
        const now = Date.now();
        const isStale = now - entry.timestamp > entry.ttl;
        if (isStale && staleWhileRevalidate) {
          fetchData().catch(() => {
            // Silently fail revalidation, keep stale data
          });
        }
      }
    } else {
      fetchData();
    }
  }, [key, enabled, getCachedData, fetchData, staleWhileRevalidate]);

  const invalidate = useCallback(() => {
    cacheRef.current.delete(key);
    setData(null);
  }, [key]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    invalidate,
  };
}
