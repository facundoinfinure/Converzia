"use client";

import { useState, useCallback, useRef } from "react";

interface UseOptimisticUpdateOptions<T> {
  onUpdate: (newValue: T) => Promise<T>;
  onError?: (error: Error, previousValue: T) => void;
  rollbackOnError?: boolean;
}

/**
 * useOptimisticUpdate - Hook para actualizaciones optimistas
 * Actualiza UI inmediatamente y hace rollback si falla
 */
export function useOptimisticUpdate<T>(
  initialValue: T,
  options: UseOptimisticUpdateOptions<T>
) {
  const { onUpdate, onError, rollbackOnError = true } = options;

  const [value, setValue] = useState<T>(initialValue);
  const previousValueRef = useRef<T>(initialValue);
  const isUpdatingRef = useRef(false);

  const update = useCallback(
    async (newValue: T) => {
      if (isUpdatingRef.current) {
        console.warn("Update already in progress, skipping");
        return;
      }

      // Store previous value for potential rollback
      previousValueRef.current = value;

      // Optimistic update
      setValue(newValue);
      isUpdatingRef.current = true;

      try {
        // Perform actual update
        const result = await onUpdate(newValue);
        setValue(result);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Update failed");

        // Rollback on error
        if (rollbackOnError) {
          setValue(previousValueRef.current);
        }

        // Call error handler
        if (onError) {
          onError(err, previousValueRef.current);
        } else {
          console.error("Optimistic update failed:", err);
        }

        throw err;
      } finally {
        isUpdatingRef.current = false;
      }
    },
    [value, onUpdate, onError, rollbackOnError]
  );

  return {
    value,
    update,
    isUpdating: isUpdatingRef.current,
  };
}
