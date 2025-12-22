"use client";

import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * DashboardCard - Premium dashboard metric card
 * Features: CSS variables, subtle animations, gradient accents
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

  const valueSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-[var(--bg-tertiary)]" />
            <div className="h-5 w-16 rounded bg-[var(--bg-tertiary)]" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-20 rounded bg-[var(--bg-tertiary)]" />
            <div className="h-4 w-24 rounded bg-[var(--bg-tertiary)]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "group transition-all duration-300 hover:shadow-[var(--shadow-md)]",
        action && "cursor-pointer",
        className
      )}
      onClick={action?.onClick}
    >
      <CardContent className="p-5">
        {/* Header with icon and trend */}
        <div className="flex items-center justify-between mb-4">
          {icon && (
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
              iconColors[iconColor]
            )}>
              <span className="h-5 w-5">{icon}</span>
            </div>
          )}

          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full",
              change.trend === "up" && "bg-[var(--success-light)]",
              change.trend === "down" && "bg-[var(--error-light)]",
              change.trend === "neutral" && "bg-[var(--bg-tertiary)]",
              trendColors[change.trend || "neutral"]
            )}>
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(change.value)}%
            </div>
          )}
        </div>

        {/* Value */}
        {value !== undefined && (
          <div className="mb-1">
            <p className={cn(
              "font-bold text-[var(--text-primary)] tabular-nums",
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
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
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
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
            <Button
              variant={action.variant || "ghost"}
              size="sm"
              className="w-full justify-between group/btn"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
            >
              <span>{action.label}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * HeroMetric - Large featured metric card for main KPIs
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
      gradient: "from-[var(--accent-primary)]/10 to-transparent",
      border: "border-[var(--accent-primary)]/20",
      icon: "text-[var(--accent-primary)]",
    },
    success: {
      gradient: "from-[var(--success)]/10 to-transparent",
      border: "border-[var(--success)]/20",
      icon: "text-[var(--success)]",
    },
    warning: {
      gradient: "from-[var(--warning)]/10 to-transparent",
      border: "border-[var(--warning)]/20",
      icon: "text-[var(--warning)]",
    },
    danger: {
      gradient: "from-[var(--error)]/10 to-transparent",
      border: "border-[var(--error)]/20",
      icon: "text-[var(--error)]",
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
      "relative overflow-hidden",
      colors.border,
      className
    )}>
      {/* Gradient background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br pointer-events-none",
        colors.gradient
      )} />
      
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(
                "h-12 w-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center shadow-sm",
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
                <span className="text-4xl font-bold text-[var(--text-primary)] tabular-nums">
                  {value}
                </span>
                {subtitle && (
                  <span className="text-[var(--text-tertiary)]">{subtitle}</span>
                )}
              </div>
            </div>
          </div>

          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trendColors[trend.direction]
            )}>
              {trend.direction === "up" && <ArrowUpRight className="h-4 w-4" />}
              {trend.direction === "down" && <ArrowDownRight className="h-4 w-4" />}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-[var(--text-tertiary)] ml-1">{trend.label}</span>
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
              size="sm"
              onClick={action.onClick}
              rightIcon={<ArrowRight className="h-4 w-4" />}
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
      "rounded-xl border p-4",
      styles.bg,
      styles.border,
      className
    )}>
      <div className="flex items-start gap-4">
        {icon && (
          <div className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
            styles.icon
          )}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-semibold", styles.title)}>
            {title}
          </h4>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {description}
          </p>
        </div>
        {action && (
          <Button
            variant="primary"
            size="sm"
            onClick={action.onClick}
            className="flex-shrink-0"
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
        "flex items-center gap-4 p-4 transition-colors",
        onClick && "cursor-pointer hover:bg-[var(--bg-tertiary)]"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
        iconColors[iconColor]
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {title}
        </p>
        {subtitle && (
          <p className="text-sm text-[var(--text-tertiary)] truncate">
            {subtitle}
          </p>
        )}
      </div>
      <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
        {timestamp}
      </span>
    </div>
  );
}
