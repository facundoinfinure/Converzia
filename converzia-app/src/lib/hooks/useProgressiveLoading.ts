"use client";

import { useState, useEffect, useCallback } from "react";

type LoadingPriority = "critical" | "high" | "medium" | "low";

interface UseProgressiveLoadingOptions {
  priorities?: LoadingPriority[];
  staggerDelay?: number;
}

interface LoadingState {
  [key: string]: {
    isLoading: boolean;
    priority: LoadingPriority;
    loaded: boolean;
  };
}

/**
 * useProgressiveLoading - Hook para loading progresivo con priorización
 * Permite cargar datos según su prioridad
 */
export function useProgressiveLoading(
  items: Array<{ id: string; priority: LoadingPriority }>,
  options: UseProgressiveLoadingOptions = {}
) {
  const { staggerDelay = 100 } = options;

  const [loadingStates, setLoadingStates] = useState<LoadingState>(() => {
    const initial: LoadingState = {};
    items.forEach((item) => {
      initial[item.id] = {
        isLoading: item.priority === "critical",
        priority: item.priority,
        loaded: false,
      };
    });
    return initial;
  });

  useEffect(() => {
    const priorityOrder: LoadingPriority[] = ["critical", "high", "medium", "low"];

    priorityOrder.forEach((priority, index) => {
      setTimeout(() => {
        setLoadingStates((prev) => {
          const updated = { ...prev };
          items.forEach((item) => {
            if (item.priority === priority) {
              updated[item.id] = {
                ...updated[item.id],
                isLoading: true,
              };
            }
          });
          return updated;
        });
      }, index * staggerDelay);
    });
  }, [items, staggerDelay]);

  const markAsLoaded = useCallback((id: string) => {
    setLoadingStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isLoading: false,
        loaded: true,
      },
    }));
  }, []);

  const isItemLoading = useCallback(
    (id: string) => loadingStates[id]?.isLoading ?? false,
    [loadingStates]
  );

  const isItemLoaded = useCallback(
    (id: string) => loadingStates[id]?.loaded ?? false,
    [loadingStates]
  );

  const isLoading = Object.values(loadingStates).some((state) => state.isLoading);

  return {
    loadingStates,
    markAsLoaded,
    isItemLoading,
    isItemLoaded,
    isLoading,
  };
}
