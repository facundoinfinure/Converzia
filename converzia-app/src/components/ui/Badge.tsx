import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        primary:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        danger:
          "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
        error:
          "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
        warning:
          "border-transparent bg-yellow-600 text-white shadow hover:bg-yellow-700",
        success:
          "border-transparent bg-green-600 text-white shadow hover:bg-green-700",
        info:
          "border-transparent bg-blue-600 text-white shadow hover:bg-blue-700",
        outline: "text-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, size, dot, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), dot && "gap-1.5", className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {props.children}
    </div>
  )
}

// Status badge helpers for common patterns
type StatusVariant = "default" | "primary" | "secondary" | "destructive" | "danger" | "error" | "warning" | "success" | "info" | "outline"

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: string
  statusMap?: Record<string, StatusVariant>
  variant?: StatusVariant  // Allow override
}

function StatusBadge({ status, statusMap, variant: overrideVariant, ...props }: StatusBadgeProps) {
  const defaultStatusMap: Record<string, StatusVariant> = {
    active: "success",
    approved: "success",
    completed: "success",
    delivered: "success",
    pending: "warning",
    processing: "info",
    inactive: "secondary",
    rejected: "danger",
    failed: "danger",
    error: "error",
  }
  
  const variant = overrideVariant || (statusMap?.[status.toLowerCase()] || defaultStatusMap[status.toLowerCase()] || "secondary") as StatusVariant
  return <Badge variant={variant} {...props}>{status}</Badge>
}

function TenantStatusBadge({ status, ...props }: Omit<StatusBadgeProps, 'statusMap'>) {
  const statusMap: Record<string, StatusVariant> = {
    active: "success",
    pending_approval: "warning",
    suspended: "danger",
    inactive: "secondary",
  }
  return <StatusBadge status={status} statusMap={statusMap} {...props} />
}

function LeadStatusBadge({ status, ...props }: Omit<StatusBadgeProps, 'statusMap'>) {
  const statusMap: Record<string, StatusVariant> = {
    new: "info",
    contacted: "primary",
    qualified: "success",
    converted: "success",
    lost: "secondary",
    spam: "danger",
  }
  return <StatusBadge status={status} statusMap={statusMap} {...props} />
}

function RoleBadge({ role, ...props }: { role: string } & Omit<BadgeProps, 'variant'>) {
  const roleMap: Record<string, StatusVariant> = {
    owner: "primary",
    admin: "info",
    viewer: "secondary",
    converzia_admin: "warning",
  }
  const variant = roleMap[role.toLowerCase()] || "secondary"
  return <Badge variant={variant} {...props}>{role}</Badge>
}

export { Badge, badgeVariants, StatusBadge, TenantStatusBadge, LeadStatusBadge, RoleBadge }
