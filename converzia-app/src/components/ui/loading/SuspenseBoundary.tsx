"use client";

import * as React from "react";
import { Suspense, ReactNode } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { cn } from "@/lib/utils";

interface SuspenseBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  className?: string;
}

/**
 * SuspenseBoundary - Wrapper que combina Suspense y Error Boundary
 * Permite carga progresiva con manejo de errores aislado
 */
export function SuspenseBoundary({
  children,
  fallback,
  errorFallback,
  onError,
  className,
}: SuspenseBoundaryProps) {
  const defaultErrorFallback = (
    <div
      className={cn(
        "rounded-xl border border-[var(--error)]/30 bg-[var(--error-light)] p-6",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--error)] mb-1">
            Error al cargar
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Ocurrió un error inesperado. Por favor, recarga la página.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      fallback={errorFallback || defaultErrorFallback}
      onError={onError}
    >
      <Suspense fallback={fallback || <div className="animate-pulse">Cargando...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
