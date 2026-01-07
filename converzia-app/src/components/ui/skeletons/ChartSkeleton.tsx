"use client";

import * as React from "react";
import { Skeleton } from "../Skeleton";
import { cn } from "@/lib/utils";

interface ChartSkeletonProps {
  className?: string;
  height?: number;
  hasTitle?: boolean;
  hasLegend?: boolean;
  type?: "line" | "bar" | "pie" | "area";
}

/**
 * ChartSkeleton - Skeleton para gráficos
 * Mantiene dimensiones exactas para evitar layout shift
 */
export function ChartSkeleton({
  className,
  height = 300,
  hasTitle = true,
  hasLegend = true,
  type = "line",
}: ChartSkeletonProps) {
  const chartHeight = height;

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 sm:p-6",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Cargando gráfico"
    >
      {/* Title */}
      {hasTitle && (
        <div className="mb-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      )}

      {/* Chart Area */}
      <div
        className="relative"
        style={{ height: `${chartHeight}px` }}
        aria-hidden="true"
      >
        {type === "line" || type === "area" ? (
          // Line/Area chart skeleton
          <div className="absolute inset-0 flex items-end justify-between gap-2 px-4">
            {Array.from({ length: 12 }).map((_, i) => {
              const barHeight = Math.random() * 60 + 20; // 20-80% height
              return (
                <div
                  key={i}
                  className="flex-1 flex items-end"
                  style={{ height: "100%" }}
                >
                  <Skeleton
                    className="w-full rounded-t"
                    style={{ height: `${barHeight}%` }}
                    variant="rectangular"
                  />
                </div>
              );
            })}
          </div>
        ) : type === "bar" ? (
          // Bar chart skeleton
          <div className="absolute inset-0 flex items-end justify-between gap-2 px-4">
            {Array.from({ length: 8 }).map((_, i) => {
              const barHeight = Math.random() * 60 + 20;
              return (
                <div
                  key={i}
                  className="flex-1 flex items-end"
                  style={{ height: "100%" }}
                >
                  <Skeleton
                    className="w-full rounded-t"
                    style={{ height: `${barHeight}%` }}
                    variant="rectangular"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Pie chart skeleton
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-48 w-48" variant="circular" />
          </div>
        )}

        {/* Grid lines (for line/area charts) */}
        {(type === "line" || type === "area") && (
          <div className="absolute inset-0 flex flex-col justify-between opacity-20">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-px w-full bg-[var(--border-primary)]"
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {hasLegend && (
        <div className="mt-4 flex flex-wrap gap-4 justify-center">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3" variant="circular" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
