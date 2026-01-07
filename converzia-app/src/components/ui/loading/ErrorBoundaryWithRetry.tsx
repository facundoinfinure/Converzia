"use client";

import * as React from "react";
import { Component, ReactNode, ErrorInfo } from "react";
import { Button } from "../Button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBoundaryWithRetryProps {
  children: ReactNode;
  onRetry?: () => void;
  maxRetries?: number;
  retryDelay?: number;
  fallback?: (error: Error, retry: () => void, retriesLeft: number) => ReactNode;
  className?: string;
}

interface ErrorBoundaryWithRetryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * ErrorBoundaryWithRetry - Error boundary con retry automático
 * Implementa backoff exponencial y retry automático
 */
export class ErrorBoundaryWithRetry extends Component<
  ErrorBoundaryWithRetryProps,
  ErrorBoundaryWithRetryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryWithRetryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryWithRetryState {
    return {
      hasError: true,
      error,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to Sentry with full context
    if (typeof window !== "undefined") {
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack,
            },
          },
          tags: {
            errorBoundary: true,
            errorBoundaryType: 'withRetry',
            retryCount: this.state.retryCount,
          },
          level: 'error',
        });
      }).catch((importError) => {
        // Fallback if Sentry import fails
        console.error("ErrorBoundaryWithRetry caught an error:", error, errorInfo);
      });
    } else {
      // Server-side logging
      console.error("ErrorBoundaryWithRetry caught an error:", error, errorInfo);
    }
    
    this.attemptRetry();
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  attemptRetry = () => {
    const { maxRetries = 3, retryDelay = 1000, onRetry } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff

      this.retryTimeoutId = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));

        if (onRetry) {
          onRetry();
        } else {
          // Force re-render to retry
          this.forceUpdate();
        }
      }, delay);
    }
  };

  handleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, maxRetries = 3, fallback, className } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.handleRetry, maxRetries - retryCount);
      }

      const retriesLeft = maxRetries - retryCount;

      return (
        <div
          className={cn(
            "rounded-xl border border-[var(--error)]/30 bg-[var(--error-light)] p-6",
            className
          )}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-[var(--error)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--error)] mb-1">
                Error al cargar
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                {error.message || "Ocurrió un error inesperado"}
              </p>
              {retriesLeft > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Reintentando automáticamente... ({retriesLeft} intentos restantes)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={this.handleRetry}
                    className="text-[var(--error)]"
                  >
                    Reintentar ahora
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleRetry}
                  className="text-[var(--error)]"
                >
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
