import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./Card";

// ============================================
// Stat Card Component
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
  iconColor = "from-primary-500 to-primary-600",
  loading = false,
  className,
}: StatCardProps) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-slate-400",
  };

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-xl bg-card-border animate-pulse" />
            <div className="h-5 w-16 rounded bg-card-border animate-pulse" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-8 w-24 rounded bg-card-border animate-pulse" />
            <div className="h-4 w-32 rounded bg-card-border animate-pulse" />
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
                "h-12 w-12 rounded-xl flex items-center justify-center shadow-lg",
                `bg-gradient-to-br ${iconColor}`
              )}
            >
              <span className="h-6 w-6 text-white">{icon}</span>
            </div>
          )}

          {change !== undefined && (
            <div className={cn("flex items-center gap-1 text-sm", trendColors[trend])}>
              <TrendIcon className="h-4 w-4" />
              {Math.abs(change)}%
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-500">
            {title}
            {changeLabel && <span className="ml-1 text-slate-600">({changeLabel})</span>}
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
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-slate-400",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg bg-card border border-card-border",
        className
      )}
    >
      {icon && (
        <div className="h-10 w-10 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 truncate">{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-white">{value}</p>
          {change && trend && (
            <span className={cn("text-xs", trendColors[trend])}>{change}</span>
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
  color?: string;
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
      bar: "bg-primary-500",
      text: "text-primary-400",
    },
    success: {
      bar: "bg-emerald-500",
      text: "text-emerald-400",
    },
    warning: {
      bar: "bg-amber-500",
      text: "text-amber-400",
    },
    danger: {
      bar: "bg-red-500",
      text: "text-red-400",
    },
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.primary;

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn("h-10 w-10 rounded-lg bg-card-border flex items-center justify-center", colors.text)}>
                {icon}
              </div>
            )}
            <span className="text-sm text-slate-400">{title}</span>
          </div>
          <span className={cn("text-sm font-medium", colors.text)}>
            {value}{unit} / {max}{unit}
          </span>
        </div>

        <div className="h-2 rounded-full bg-card-border overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-slate-500 text-right">
          {percentage.toFixed(0)}% usado
        </p>
      </CardContent>
    </Card>
  );
}

