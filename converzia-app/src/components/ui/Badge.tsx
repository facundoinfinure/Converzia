import { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Badge Component - Clean, Modern Design
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
    default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
    primary: "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]",
    secondary: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
    success: "bg-[var(--success-light)] text-[var(--success-dark)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning-dark)]",
    danger: "bg-[var(--error-light)] text-[var(--error-dark)]",
    info: "bg-[var(--info-light)] text-[var(--info-dark)]",
    outline: "bg-transparent text-[var(--text-secondary)] border border-[var(--border-primary)]",
  };

  const dotColors = {
    default: "bg-[var(--text-tertiary)]",
    primary: "bg-[var(--accent-primary)]",
    secondary: "bg-[var(--text-tertiary)]",
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    danger: "bg-[var(--error)]",
    info: "bg-[var(--info)]",
    outline: "bg-[var(--text-tertiary)]",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full",
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
  | "archived"
  | "paid"
  | "failed";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
  showDot?: boolean;
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
  paid: { variant: "success", label: "Pagado" },
  failed: { variant: "danger", label: "Fallido" },
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] || {
    variant: "default" as BadgeVariant,
    label: status,
  };

  return (
    <Badge variant={config.variant} dot={showDot} className={className}>
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
  LEAD_READY: { variant: "success", label: "Listo" },
  SENT_TO_DEVELOPER: { variant: "success", label: "Entregado" },
  COOLING: { variant: "secondary", label: "En pausa" },
  REACTIVATION: { variant: "warning", label: "Reactivación" },
  DISQUALIFIED: { variant: "danger", label: "Descalificado" },
  STOPPED: { variant: "danger", label: "Detenido" },
  HUMAN_HANDOFF: { variant: "warning", label: "Derivado" },
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
  OWNER: { variant: "primary", label: "Propietario" },
  ADMIN: { variant: "info", label: "Administrador" },
  BILLING: { variant: "warning", label: "Facturación" },
  VIEWER: { variant: "secondary", label: "Visor" },
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

// ============================================
// Count Badge (for notification counts)
// ============================================

interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeVariant;
  className?: string;
}

export function CountBadge({ count, max = 99, variant = "danger", className }: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count;
  
  if (count === 0) return null;
  
  return (
    <Badge variant={variant} size="sm" className={cn("min-w-[20px] justify-center", className)}>
      {displayCount}
    </Badge>
  );
}







