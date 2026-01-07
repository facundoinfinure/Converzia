"use client";

import { useEffect, useRef } from "react";

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

interface UsePerformanceTrackingOptions {
  metric: string;
  startTime?: number;
  endTime?: number;
  enabled?: boolean;
  onComplete?: (metric: PerformanceMetric) => void;
}

/**
 * usePerformanceTracking - Hook para trackear métricas de performance
 * Útil para medir TTFS, TTI, CLS, etc.
 */
export function usePerformanceTracking(
  options: UsePerformanceTrackingOptions
) {
  const {
    metric,
    startTime,
    endTime,
    enabled = true,
    onComplete,
  } = options;

  const startTimeRef = useRef<number>(startTime || performance.now());
  const endTimeRef = useRef<number | null>(endTime || null);

  useEffect(() => {
    if (!enabled) return;

    if (endTime) {
      endTimeRef.current = endTime;
    }
  }, [endTime, enabled]);

  const markStart = () => {
    startTimeRef.current = performance.now();
  };

  const markEnd = () => {
    endTimeRef.current = performance.now();
    const duration = endTimeRef.current - startTimeRef.current;

    const performanceMetric: PerformanceMetric = {
      name: metric,
      value: duration,
      timestamp: Date.now(),
    };

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[Performance] ${metric}: ${duration.toFixed(2)}ms`);
    }

    // Call onComplete callback if provided
    if (onComplete) {
      onComplete(performanceMetric);
    }

    // Send to analytics if available
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "performance_metric", {
        metric_name: metric,
        metric_value: duration,
      });
    }
  };

  return {
    markStart,
    markEnd,
    duration: endTimeRef.current
      ? endTimeRef.current - startTimeRef.current
      : null,
  };
}
