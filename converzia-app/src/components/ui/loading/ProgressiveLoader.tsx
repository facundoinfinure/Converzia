"use client";

import * as React from "react";
import { ReactNode, useState, useEffect } from "react";
import { SuspenseBoundary } from "./SuspenseBoundary";
import { cn } from "@/lib/utils";

interface LoadingPriority {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const PRIORITIES: LoadingPriority = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface ProgressiveSection {
  id: string;
  priority: keyof LoadingPriority;
  component: ReactNode;
  fallback: ReactNode;
  errorFallback?: ReactNode;
}

interface ProgressiveLoaderProps {
  sections: ProgressiveSection[];
  className?: string;
}

/**
 * ProgressiveLoader - Carga progresiva con priorización
 * Carga secciones según su prioridad (critical → high → medium → low)
 */
export function ProgressiveLoader({
  sections,
  className,
}: ProgressiveLoaderProps) {
  const [loadedPriorities, setLoadedPriorities] = useState<Set<keyof LoadingPriority>>(
    new Set()
  );

  // Sort sections by priority
  const sortedSections = [...sections].sort(
    (a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority]
  );

  useEffect(() => {
    // Load sections progressively based on priority
    const loadPriority = (priority: keyof LoadingPriority) => {
      setTimeout(() => {
        setLoadedPriorities((prev) => new Set([...prev, priority]));
      }, PRIORITIES[priority] * 100); // Stagger by 100ms per priority level
    };

    // Start loading critical immediately
    loadPriority("critical");

    // Load other priorities with delay
    Object.keys(PRIORITIES).forEach((priority) => {
      if (priority !== "critical") {
        loadPriority(priority as keyof LoadingPriority);
      }
    });
  }, []);

  return (
    <div className={cn("space-y-4 sm:space-y-6", className)}>
      {sortedSections.map((section) => {
        const shouldLoad =
          loadedPriorities.has(section.priority) ||
          section.priority === "critical";

        return (
          <SuspenseBoundary
            key={section.id}
            fallback={section.fallback}
            errorFallback={section.errorFallback}
          >
            {shouldLoad ? section.component : section.fallback}
          </SuspenseBoundary>
        );
      })}
    </div>
  );
}
