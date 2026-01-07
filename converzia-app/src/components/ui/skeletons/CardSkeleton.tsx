"use client";

import * as React from "react";
import { Skeleton } from "../Skeleton";
import { cn } from "@/lib/utils";

interface CardSkeletonProps {
  className?: string;
  hasHeader?: boolean;
  hasImage?: boolean;
  hasActions?: boolean;
  hasFooter?: boolean;
  lines?: number;
}

/**
 * CardSkeleton - Skeleton para cards con estructura completa
 * Mantiene dimensiones exactas para evitar layout shift
 */
export function CardSkeleton({
  className,
  hasHeader = true,
  hasImage = false,
  hasActions = false,
  hasFooter = false,
  lines = 3,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-hidden",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Cargando card"
    >
      {/* Image */}
      {hasImage && (
        <Skeleton className="h-48 w-full rounded-none" variant="rectangular" />
      )}

      <div className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        {hasHeader && (
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-16" />
          </div>
        )}

        {/* Content Lines */}
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-4",
                i === lines - 1 ? "w-3/4" : "w-full"
              )}
            />
          ))}
        </div>

        {/* Actions */}
        {hasActions && (
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-24" variant="rectangular" />
            <Skeleton className="h-9 w-24" variant="rectangular" />
          </div>
        )}
      </div>

      {/* Footer */}
      {hasFooter && (
        <div className="px-4 sm:px-6 py-3 border-t border-[var(--border-primary)]">
          <Skeleton className="h-4 w-32" />
        </div>
      )}
    </div>
  );
}
