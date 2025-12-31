"use client";

import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * DashboardCard - Premium dashboard metric card
 * Mobile-first with touch-friendly interactions
 */
export interface DashboardCardProps {
  title: string;
  description?: string;
  value?: string | number;
  change?: {
    value: number;
    label?: string;
    trend?: "up" | "down" | "neutral";
  };
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "ghost";
  };
  icon?: ReactNode;
  iconColor?: "primary" | "success" | "warning" | "danger" | "info";
  children?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function DashboardCard({
  title,
  description,
  value,
  change,
  action,
  icon,
  iconColor = "primary",
  children,
  className,
  size = "md",
  loading = false,
}: DashboardCardProps) {
  const trendColors = {
    up: "text-[var(--success)]",
    down: "text-[var(--error)]",
    neutral: "text-[var(--text-tertiary)]",
  };

  const iconColors = {
    primary: "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--error-light)] text-[var(--error)]",
    info: "bg-[var(--info-light)] text-[var(--info)]",
  };

  const TrendIcon = change?.trend === "up" 
    ? ArrowUpRight 
    : change?.trend === "down" 
    ? ArrowDownRight 
    : Minus;

  // Mobile-responsive value sizes
  const valueSizes = {
    sm: "text-xl sm:text-2xl",
    md: "text-2xl sm:text-3xl",
    lg: "text-3xl sm:text-4xl",
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl skeleton" />
            <div className="h-6 w-16 rounded-full skeleton" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-20 rounded skeleton" />
            <div className="h-4 w-24 rounded skeleton" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "group transition-all duration-300",
        "hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5",
        "active:scale-[0.99] active:translate-y-0",
        action && "cursor-pointer",
        className
      )}
      onClick={action?.onClick}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Header with icon and trend */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          {icon && (
            <div className={cn(
              "h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center",
              "transition-all duration-300 group-hover:scale-110 group-hover:shadow-md",
              iconColors[iconColor]
            )}>
              <span className="h-5 w-5">{icon}</span>
            </div>
          )}

          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full",
              "transition-transform duration-300 group-hover:scale-105",
              change.trend === "up" && "bg-[var(--success-light)]",
              change.trend === "down" && "bg-[var(--error-light)]",
              change.trend === "neutral" && "bg-[var(--bg-tertiary)]",
              trendColors[change.trend || "neutral"]
            )}>
              <TrendIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {Math.abs(change.value)}%
            </div>
          )}
        </div>

        {/* Value */}
        {value !== undefined && (
          <div className="mb-1">
            <p className={cn(
              "font-bold text-[var(--text-primary)] tabular-nums",
              "font-[var(--font-display)] tracking-tight",
              valueSizes[size]
            )}>
              {value}
            </p>
          </div>
        )}

        {/* Title & Description */}
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {title}
          </p>
          {description && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
          {change?.label && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {change.label}
            </p>
          )}
        </div>

        {/* Children content */}
        {children && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
            {children}
          </div>
        )}

        {/* Action button */}
        {action && (
          <div className="mt-4 pt-3 border-t border-[var(--border-primary)]">
            <Button
              variant={action.variant || "ghost"}
              size="sm"
              className="w-full justify-between group/btn"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
            >
              <span className="text-sm">{action.label}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * HeroMetric - Large featured metric card for main KPIs
 * Mobile-optimized with responsive sizing
 */
export interface HeroMetricProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    direction: "up" | "down" | "neutral";
  };
  chart?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  accentColor?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

export function HeroMetric({
  title,
  value,
  subtitle,
  trend,
  chart,
  action,
  icon,
  accentColor = "primary",
  className,
}: HeroMetricProps) {
  const accentColors = {
    primary: {
      gradient: "from-[var(--accent-primary)]/10 via-[var(--accent-primary)]/5 to-transparent",
      border: "border-[var(--accent-primary)]/20",
      icon: "text-[var(--accent-primary)] bg-gradient-to-br from-[var(--accent-primary-light)] to-[var(--bg-secondary)]",
    },
    success: {
      gradient: "from-[var(--success)]/10 via-[var(--success)]/5 to-transparent",
      border: "border-[var(--success)]/20",
      icon: "text-[var(--success)] bg-gradient-to-br from-[var(--success-light)] to-[var(--bg-secondary)]",
    },
    warning: {
      gradient: "from-[var(--warning)]/10 via-[var(--warning)]/5 to-transparent",
      border: "border-[var(--warning)]/20",
      icon: "text-[var(--warning)] bg-gradient-to-br from-[var(--warning-light)] to-[var(--bg-secondary)]",
    },
    danger: {
      gradient: "from-[var(--error)]/10 via-[var(--error)]/5 to-transparent",
      border: "border-[var(--error)]/20",
      icon: "text-[var(--error)] bg-gradient-to-br from-[var(--error-light)] to-[var(--bg-secondary)]",
    },
  };

  const colors = accentColors[accentColor];

  const trendColors = {
    up: "text-[var(--success)]",
    down: "text-[var(--error)]",
    neutral: "text-[var(--text-tertiary)]",
  };

  return (
    <Card className={cn(
      "relative overflow-hidden animate-fadeInUp",
      colors.border,
      className
    )}>
      {/* Gradient background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br pointer-events-none",
        colors.gradient
      )} />
      
      <CardContent className="relative p-4 sm:p-6">
        {/* Mobile: Stack layout, Desktop: Row layout */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {icon && (
              <div className={cn(
                "h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border border-[var(--border-primary)]",
                "flex items-center justify-center shadow-sm",
                "transition-transform duration-300 hover:scale-110",
                colors.icon
              )}>
                {icon}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {title}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tabular-nums font-[var(--font-display)] tracking-tight">
                  {value}
                </span>
                {subtitle && (
                  <span className="text-sm text-[var(--text-tertiary)]">{subtitle}</span>
                )}
              </div>
            </div>
          </div>

          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full",
              "bg-[var(--bg-primary)] border border-[var(--border-primary)]",
              "self-start",
              trendColors[trend.direction]
            )}>
              {trend.direction === "up" && <ArrowUpRight className="h-4 w-4" />}
              {trend.direction === "down" && <ArrowDownRight className="h-4 w-4" />}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-[var(--text-tertiary)] ml-1 text-xs">{trend.label}</span>
            </div>
          )}
        </div>

        {/* Chart area */}
        {chart && (
          <div className="mt-4">
            {chart}
          </div>
        )}

        {/* Action */}
        {action && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
            <Button
              variant="primary"
              size="md"
              onClick={action.onClick}
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              {action.label}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * AlertCard - For actionable alerts/warnings
 * Touch-friendly with clear CTAs
 */
export interface AlertCardProps {
  title: string;
  description: string;
  type: "info" | "warning" | "danger" | "success";
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export function AlertCard({
  title,
  description,
  type,
  icon,
  action,
  onDismiss,
  className,
}: AlertCardProps) {
  const typeStyles = {
    info: {
      bg: "bg-[var(--info-light)]",
      border: "border-[var(--info)]/30",
      icon: "bg-[var(--info)]/20 text-[var(--info)]",
      title: "text-[var(--info-dark)]",
    },
    warning: {
      bg: "bg-[var(--warning-light)]",
      border: "border-[var(--warning)]/30",
      icon: "bg-[var(--warning)]/20 text-[var(--warning)]",
      title: "text-[var(--warning-dark)]",
    },
    danger: {
      bg: "bg-[var(--error-light)]",
      border: "border-[var(--error)]/30",
      icon: "bg-[var(--error)]/20 text-[var(--error)]",
      title: "text-[var(--error-dark)]",
    },
    success: {
      bg: "bg-[var(--success-light)]",
      border: "border-[var(--success)]/30",
      icon: "bg-[var(--success)]/20 text-[var(--success)]",
      title: "text-[var(--success-dark)]",
    },
  };

  const styles = typeStyles[type];

  return (
    <div className={cn(
      "rounded-2xl border p-4 animate-fadeInUp",
      styles.bg,
      styles.border,
      className
    )}>
      {/* Mobile: Stack layout for action, Desktop: Row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {icon && (
            <div className={cn(
              "h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center flex-shrink-0",
              styles.icon
            )}>
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className={cn("font-semibold text-sm sm:text-base", styles.title)}>
              {title}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 line-clamp-2">
              {description}
            </p>
          </div>
        </div>
        {action && (
          <Button
            variant="primary"
            size="md"
            onClick={action.onClick}
            className="flex-shrink-0 w-full sm:w-auto"
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * ActivityItem - For activity feeds/lists
 * Touch-friendly with minimum tap target
 */
export interface ActivityItemProps {
  icon: ReactNode;
  iconColor?: "primary" | "success" | "warning" | "danger" | "neutral";
  title: string;
  subtitle?: string;
  timestamp: string;
  onClick?: () => void;
}

export function ActivityItem({
  icon,
  iconColor = "neutral",
  title,
  subtitle,
  timestamp,
  onClick,
}: ActivityItemProps) {
  const iconColors = {
    primary: "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    danger: "bg-[var(--error-light)] text-[var(--error)]",
    neutral: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
  };

  return (
    <div 
      className={cn(
        // Touch-friendly minimum height
        "flex items-center gap-3 sm:gap-4 p-4 min-h-[64px]",
        "transition-all duration-200",
        onClick && "cursor-pointer hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-secondary)]"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
        iconColors[iconColor]
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[var(--text-tertiary)] truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <span className="text-[11px] sm:text-xs text-[var(--text-tertiary)] flex-shrink-0 font-medium">
        {timestamp}
      </span>
    </div>
  );
}

/**
 * QuickActionCard - For quick action buttons on mobile
 */
export interface QuickActionCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
  variant?: "default" | "primary";
  className?: string;
}

export function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  variant = "default",
  className,
}: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4",
        "rounded-2xl min-h-[100px] w-full",
        "transition-all duration-200",
        "active:scale-[0.97]",
        variant === "default" && [
          "bg-[var(--bg-primary)] border border-[var(--border-primary)]",
          "hover:border-[var(--border-secondary)] hover:shadow-md",
        ],
        variant === "primary" && [
          "bg-gradient-to-br from-[var(--accent-primary)] to-purple-600",
          "text-white shadow-lg shadow-[var(--accent-primary)]/25",
          "hover:shadow-xl hover:shadow-[var(--accent-primary)]/30",
        ],
        className
      )}
    >
      <div className={cn(
        "h-11 w-11 rounded-xl flex items-center justify-center",
        variant === "default" && "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]",
        variant === "primary" && "bg-white/20 text-white"
      )}>
        {icon}
      </div>
      <div className="text-center">
        <p className={cn(
          "text-sm font-semibold",
          variant === "default" && "text-[var(--text-primary)]",
          variant === "primary" && "text-white"
        )}>
          {title}
        </p>
        {description && (
          <p className={cn(
            "text-xs mt-0.5",
            variant === "default" && "text-[var(--text-tertiary)]",
            variant === "primary" && "text-white/70"
          )}>
            {description}
          </p>
        )}
      </div>
    </button>
  );
}
