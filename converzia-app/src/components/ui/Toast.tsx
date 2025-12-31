"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

type ToastVariant = "info" | "success" | "warning" | "error";

interface Toast {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  // Convenience methods
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

// ============================================
// Context
// ============================================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

interface ToastProviderProps {
  children: ReactNode;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}

export function ToastProvider({ children, position = "bottom-center" }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback(
    (message: string, title?: string) => addToast({ variant: "success", message, title }),
    [addToast]
  );

  const error = useCallback(
    (message: string, title?: string) => addToast({ variant: "error", message, title }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, title?: string) => addToast({ variant: "warning", message, title }),
    [addToast]
  );

  const info = useCallback(
    (message: string, title?: string) => addToast({ variant: "info", message, title }),
    [addToast]
  );

  const positions = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  };

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info }}
    >
      {children}

      {/* Toast container */}
      <div className={cn("fixed z-[var(--z-toast)] flex flex-col gap-2 w-full max-w-md", positions[position])}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ============================================
// Toast Item - Modern dark style
// ============================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const variants = {
    info: {
      icon: <Info className="h-5 w-5 text-[var(--info)]" />,
      iconBg: "bg-[var(--info)]",
    },
    success: {
      icon: <CheckCircle className="h-5 w-5 text-[var(--success)]" />,
      iconBg: "bg-[var(--success)]",
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />,
      iconBg: "bg-[var(--warning)]",
    },
    error: {
      icon: <AlertCircle className="h-5 w-5 text-[var(--error)]" />,
      iconBg: "bg-[var(--error)]",
    },
  };

  const config = variants[toast.variant];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl",
        "bg-[#1F2937] text-white shadow-xl",
        "animate-in slide-in-from-bottom-2 fade-in duration-300"
      )}
      role="alert"
    >
      {/* Icon with colored dot */}
      <div className="flex-shrink-0 relative">
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="font-medium text-white text-sm">{toast.title}</h4>
        )}
        <p className="text-sm text-gray-300">{toast.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================
// Standalone Toast Function (for outside React)
// ============================================

// This is a simple implementation - in production you'd want something more robust
let toastHandler: ToastContextType | null = null;

export function setToastHandler(handler: ToastContextType) {
  toastHandler = handler;
}

export const toast = {
  success: (message: string, title?: string) => toastHandler?.success(message, title),
  error: (message: string, title?: string) => toastHandler?.error(message, title),
  warning: (message: string, title?: string) => toastHandler?.warning(message, title),
  info: (message: string, title?: string) => toastHandler?.info(message, title),
};









