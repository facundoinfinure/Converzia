"use client";

import { useState, useCallback, useMemo } from "react";

type LoadingKey = string;

interface LoadingState {
  [key: LoadingKey]: boolean;
}

interface UseLoadingStateOptions {
  initialStates?: LoadingState;
}

/**
 * useLoadingState - Hook unificado para manejar estados de carga
 * Permite gestionar múltiples estados de carga de forma granular
 */
export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const { initialStates = {} } = options;

  const [loadingStates, setLoadingStates] = useState<LoadingState>(initialStates);

  const setLoading = useCallback((key: LoadingKey, isLoading: boolean) => {
    setLoadingStates((prev) => ({
      ...prev,
      [key]: isLoading,
    }));
  }, []);

  const setMultipleLoading = useCallback((states: Partial<LoadingState>) => {
    setLoadingStates((prev) => {
      const updated = { ...prev };
      Object.entries(states).forEach(([key, value]) => {
        if (value !== undefined) {
          updated[key] = value;
        }
      });
      return updated;
    });
  }, []);

  const isLoading = useCallback(
    (key: LoadingKey) => loadingStates[key] ?? false,
    [loadingStates]
  );

  const isAnyLoading = useMemo(
    () => Object.values(loadingStates).some((state) => state === true),
    [loadingStates]
  );

  const reset = useCallback(() => {
    setLoadingStates(initialStates);
  }, [initialStates]);

  return {
    loadingStates,
    setLoading,
    setMultipleLoading,
    isLoading,
    isAnyLoading,
    reset,
  };
}
