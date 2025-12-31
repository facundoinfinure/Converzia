import { ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Alert Component
// ============================================

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}

export function Alert({
  variant = "info",
  title,
  children,
  icon,
  dismissible = false,
  onDismiss,
  action,
  className,
}: AlertProps) {
  const variants = {
    info: {
      container: "bg-blue-500/10 border-blue-500/30 text-blue-400",
      icon: <Info className="h-5 w-5" />,
    },
    success: {
      container: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      icon: <CheckCircle className="h-5 w-5" />,
    },
    warning: {
      container: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      icon: <AlertTriangle className="h-5 w-5" />,
    },
    error: {
      container: "bg-red-500/10 border-red-500/30 text-red-400",
      icon: <AlertCircle className="h-5 w-5" />,
    },
  };

  const config = variants[variant];

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg border",
        config.container,
        className
      )}
      role="alert"
    >
      <div className="flex-shrink-0">{icon || config.icon}</div>

      <div className="flex-1 min-w-0">
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <div className="text-sm opacity-90">{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>

      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================
// Inline Alert (smaller, for forms)
// ============================================

interface InlineAlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}

export function InlineAlert({
  variant = "info",
  children,
  className,
}: InlineAlertProps) {
  const variants = {
    info: "text-blue-400",
    success: "text-emerald-400",
    warning: "text-amber-400",
    error: "text-red-400",
  };

  const icons = {
    info: <Info className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm",
        variants[variant],
        className
      )}
    >
      {icons[variant]}
      {children}
    </div>
  );
}

// ============================================
// Banner Alert (full width, top of page)
// ============================================

interface BannerAlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  action?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function BannerAlert({
  variant = "info",
  children,
  action,
  dismissible = false,
  onDismiss,
  className,
}: BannerAlertProps) {
  const variants = {
    info: "bg-blue-500/20 border-blue-500/30 text-blue-300",
    success: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
    warning: "bg-amber-500/20 border-amber-500/30 text-amber-300",
    error: "bg-red-500/20 border-red-500/30 text-red-300",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 border-b",
        variants[variant],
        className
      )}
    >
      <div className="flex-1 text-sm">{children}</div>

      <div className="flex items-center gap-3">
        {action}
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}











