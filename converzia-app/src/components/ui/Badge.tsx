import { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Badge Component
// ============================================

export type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  removable = false,
  onRemove,
  className,
}: BadgeProps) {
  const variants = {
    default: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    primary: "bg-primary-500/20 text-primary-400 border-primary-500/30",
    secondary: "bg-slate-600/20 text-slate-400 border-slate-600/30",
    success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    danger: "bg-red-500/20 text-red-400 border-red-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    outline: "bg-transparent text-slate-400 border-card-border",
  };

  const dotColors = {
    default: "bg-slate-400",
    primary: "bg-primary-400",
    secondary: "bg-slate-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-red-400",
    info: "bg-blue-400",
    outline: "bg-slate-400",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-md border",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])}
        />
      )}
      {children}
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

// ============================================
// Status Badge (for common statuses)
// ============================================

type StatusType =
  | "active"
  | "inactive"
  | "pending"
  | "success"
  | "error"
  | "warning"
  | "draft"
  | "archived";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

const statusConfig: Record<StatusType, { variant: BadgeVariant; label: string }> = {
  active: { variant: "success", label: "Activo" },
  inactive: { variant: "secondary", label: "Inactivo" },
  pending: { variant: "warning", label: "Pendiente" },
  success: { variant: "success", label: "Exitoso" },
  error: { variant: "danger", label: "Error" },
  warning: { variant: "warning", label: "Advertencia" },
  draft: { variant: "secondary", label: "Borrador" },
  archived: { variant: "default", label: "Archivado" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] || {
    variant: "default" as BadgeVariant,
    label: status,
  };

  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}

// ============================================
// Lead Status Badge (specific for lead states)
// ============================================

interface LeadStatusBadgeProps {
  status: string;
  className?: string;
}

const leadStatusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  PENDING_MAPPING: { variant: "warning", label: "Sin mapear" },
  TO_BE_CONTACTED: { variant: "info", label: "Por contactar" },
  CONTACTED: { variant: "info", label: "Contactado" },
  ENGAGED: { variant: "primary", label: "Interesado" },
  QUALIFYING: { variant: "primary", label: "Calificando" },
  SCORED: { variant: "primary", label: "Calificado" },
  LEAD_READY: { variant: "success", label: "Lead Ready" },
  SENT_TO_DEVELOPER: { variant: "success", label: "Enviado" },
  COOLING: { variant: "secondary", label: "En pausa" },
  REACTIVATION: { variant: "warning", label: "Reactivación" },
  DISQUALIFIED: { variant: "danger", label: "Descalificado" },
  STOPPED: { variant: "danger", label: "Detenido" },
  HUMAN_HANDOFF: { variant: "warning", label: "Handoff" },
};

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const config = leadStatusConfig[status] || {
    variant: "default" as BadgeVariant,
    label: status,
  };

  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}

// ============================================
// Tenant Status Badge
// ============================================

interface TenantStatusBadgeProps {
  status: string;
  className?: string;
}

const tenantStatusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  PENDING: { variant: "warning", label: "Pendiente" },
  ACTIVE: { variant: "success", label: "Activo" },
  SUSPENDED: { variant: "danger", label: "Suspendido" },
  ARCHIVED: { variant: "secondary", label: "Archivado" },
};

export function TenantStatusBadge({ status, className }: TenantStatusBadgeProps) {
  const config = tenantStatusConfig[status] || {
    variant: "default" as BadgeVariant,
    label: status,
  };

  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}

// ============================================
// Role Badge
// ============================================

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleConfig: Record<string, { variant: BadgeVariant; label: string }> = {
  OWNER: { variant: "primary", label: "Owner" },
  ADMIN: { variant: "info", label: "Admin" },
  BILLING: { variant: "warning", label: "Billing" },
  VIEWER: { variant: "secondary", label: "Viewer" },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role] || {
    variant: "default" as BadgeVariant,
    label: role,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

