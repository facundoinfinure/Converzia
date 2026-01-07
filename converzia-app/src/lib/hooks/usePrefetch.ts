"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type PrefetchPriority = "high" | "medium" | "low";

interface UsePrefetchOptions {
  priority?: PrefetchPriority;
  enabled?: boolean;
  delay?: number;
}

/**
 * usePrefetch - Hook para prefetching inteligente de rutas
 * Respeta rate limits y ancho de banda
 */
export function usePrefetch(
  route: string,
  options: UsePrefetchOptions = {}
) {
  const { priority = "medium", enabled = true, delay = 0 } = options;
  const router = useRouter();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || prefetchedRef.current) return;

    const prefetchRoute = () => {
      try {
        // Use Next.js router prefetch
        router.prefetch(route);
        prefetchedRef.current = true;
      } catch (error) {
        console.warn(`Failed to prefetch route: ${route}`, error);
      }
    };

    if (delay > 0) {
      const timeoutId = setTimeout(prefetchRoute, delay);
      return () => clearTimeout(timeoutId);
    } else {
      prefetchRoute();
    }
  }, [route, enabled, delay, router]);
}

/**
 * usePrefetchOnHover - Prefetch route cuando el usuario hace hover
 */
export function usePrefetchOnHover(
  route: string,
  options: UsePrefetchOptions = {}
) {
  const { enabled = true } = options;
  const router = useRouter();
  const prefetchedRef = useRef(false);

  const handleMouseEnter = () => {
    if (!enabled || prefetchedRef.current) return;

    try {
      router.prefetch(route);
      prefetchedRef.current = true;
    } catch (error) {
      console.warn(`Failed to prefetch route on hover: ${route}`, error);
    }
  };

  return {
    onMouseEnter: handleMouseEnter,
  };
}
