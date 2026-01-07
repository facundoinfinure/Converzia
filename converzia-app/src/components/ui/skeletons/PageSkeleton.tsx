"use client";

import * as React from "react";
import { Skeleton } from "../Skeleton";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  className?: string;
  showHeader?: boolean;
  showStats?: boolean;
  showContent?: boolean;
  statsCount?: number;
  contentRows?: number;
}

/**
 * PageSkeleton - Skeleton para páginas completas
 * Mantiene layout stability (zero CLS) con dimensiones exactas
 */
export function PageSkeleton({
  className,
  showHeader = true,
  showStats = true,
  showContent = true,
  statsCount = 4,
  contentRows = 2,
}: PageSkeletonProps) {
  return (
    <div
      className={cn("space-y-4 sm:space-y-6", className)}
      role="status"
      aria-live="polite"
      aria-label="Cargando página"
    >
      {/* Header */}
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 sm:w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      )}

      {/* Stats Grid */}
      {showStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: statsCount }).map((_, i) => (
            <Skeleton key={i} className="h-28 sm:h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Content Area */}
      {showContent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {Array.from({ length: contentRows }).map((_, i) => (
            <Skeleton key={i} className="h-56 sm:h-64 rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  );
}
