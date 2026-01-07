"use client";

import * as React from "react";
import { Skeleton } from "../Skeleton";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  className?: string;
  columns?: number;
  rows?: number;
  hasHeader?: boolean;
  hasCheckbox?: boolean;
  hasActions?: boolean;
}

/**
 * TableSkeleton - Skeleton completo para tablas
 * Incluye header y filas con dimensiones exactas
 */
export function TableSkeleton({
  className,
  columns = 5,
  rows = 5,
  hasHeader = true,
  hasCheckbox = false,
  hasActions = false,
}: TableSkeletonProps) {
  return (
    <div
      className={cn("rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-hidden", className)}
      role="status"
      aria-live="polite"
      aria-label="Cargando tabla"
    >
      {/* Table Header */}
      {hasHeader && (
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-4">
            {hasCheckbox && <Skeleton className="h-5 w-5" variant="rectangular" />}
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-4 flex-1",
                  i === 0 ? "max-w-[200px]" : "max-w-[150px]"
                )}
              />
            ))}
            {hasActions && <Skeleton className="h-4 w-20" />}
          </div>
        </div>
      )}

      {/* Table Rows */}
      <div className="divide-y divide-[var(--border-primary)]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 px-4 sm:px-6 py-4"
          >
            {hasCheckbox && (
              <Skeleton className="h-5 w-5" variant="rectangular" />
            )}
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  "h-5 flex-1",
                  colIndex === 0 ? "max-w-[200px]" : "max-w-[150px]"
                )}
              />
            ))}
            {hasActions && (
              <Skeleton className="h-8 w-20" variant="rectangular" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
