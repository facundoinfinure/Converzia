import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./Card";

// ============================================
// Stat Card Component - Clean, Modern Design
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  icon?: ReactNode;
  iconColor?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  trend = "neutral",
  icon,
  iconColor,
  loading = false,
  className,
}: StatCardProps) {
  const trendColors = {
    up: "text-[var(--success)]",
    down: "text-[var(--error)]",
    neutral: "text-[var(--text-tertiary)]",
  };

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-xl bg-[var(--bg-tertiary)] animate-pulse" />
            <div className="h-5 w-16 rounded bg-[var(--bg-tertiary)] animate-pulse" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-8 w-24 rounded bg-[var(--bg-tertiary)] animate-pulse" />
            <div className="h-4 w-32 rounded bg-[var(--bg-tertiary)] animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          {icon && (
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center text-white",
                iconColor?.includes("from-") 
                  ? `bg-gradient-to-br ${iconColor}` 
                  : iconColor || "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]"
              )}
            >
              <span className="h-6 w-6">{icon}</span>
            </div>
          )}

          {change !== undefined && (
            <div className={cn("flex items-center gap-1 text-sm font-medium", trendColors[trend])}>
              <TrendIcon className="h-4 w-4" />
              {Math.abs(change)}%
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {title}
            {changeLabel && <span className="ml-1 text-[var(--text-tertiary)]">({changeLabel})</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Mini Stat Card (compact version)
// ============================================

interface MiniStatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  change?: string;
  className?: string;
}

export function MiniStatCard({
  title,
  value,
  icon,
  trend,
  change,
  className,
}: MiniStatCardProps) {
  const trendColors = {
    up: "text-[var(--success)]",
    down: "text-[var(--error)]",
    neutral: "text-[var(--text-tertiary)]",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)]",
        className
      )}
    >
      {icon && (
        <div className="h-10 w-10 rounded-lg bg-[var(--accent-primary-light)] flex items-center justify-center text-[var(--accent-primary)]">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-secondary)] truncate">{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
          {change && trend && (
            <span className={cn("text-xs font-medium", trendColors[trend])}>{change}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Stats Grid
// ============================================

interface StatsGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const colClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", colClasses[columns], className)}>
      {children}
    </div>
  );
}

// ============================================
// Progress Stat Card
// ============================================

interface ProgressStatCardProps {
  title: string;
  value: number;
  max: number;
  unit?: string;
  icon?: ReactNode;
  color?: "primary" | "success" | "warning" | "danger";
  className?: string;
}

export function ProgressStatCard({
  title,
  value,
  max,
  unit = "",
  icon,
  color = "primary",
  className,
}: ProgressStatCardProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    primary: {
      bar: "bg-[var(--accent-primary)]",
      text: "text-[var(--accent-primary)]",
    },
    success: {
      bar: "bg-[var(--success)]",
      text: "text-[var(--success)]",
    },
    warning: {
      bar: "bg-[var(--warning)]",
      text: "text-[var(--warning)]",
    },
    danger: {
      bar: "bg-[var(--error)]",
      text: "text-[var(--error)]",
    },
  };

  const colors = colorClasses[color];

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn("h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center", colors.text)}>
                {icon}
              </div>
            )}
            <span className="text-sm text-[var(--text-secondary)]">{title}</span>
          </div>
          <span className={cn("text-sm font-medium", colors.text)}>
            {value}{unit} / {max}{unit}
          </span>
        </div>

        <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-[var(--text-tertiary)] text-right">
          {percentage.toFixed(0)}% usado
        </p>
      </CardContent>
    </Card>
  );
}










