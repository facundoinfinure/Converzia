import { ReactNode } from "react";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./Card";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

// ============================================
// Stat Card Component - Premium shadcn Design
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
  tooltip?: string;
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
  tooltip,
}: StatCardProps) {
  const trendConfig = {
    up: { 
      color: "text-emerald-600 dark:text-emerald-400", 
      bg: "bg-emerald-500/10",
      Icon: TrendingUp 
    },
    down: { 
      color: "text-red-600 dark:text-red-400", 
      bg: "bg-red-500/10",
      Icon: TrendingDown 
    },
    neutral: { 
      color: "text-muted-foreground", 
      bg: "bg-muted",
      Icon: Minus 
    },
  };

  const { color: trendColor, bg: trendBg, Icon: TrendIcon } = trendConfig[trend];

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-28 rounded bg-muted animate-pulse mb-2" />
          <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const cardContent = (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      "hover:shadow-md hover:-translate-y-0.5",
      tooltip && "cursor-help",
      className
    )}>
      <CardContent className="p-6">
        {/* Header: Title + Tooltip Icon */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            {title}
          </h3>
          {tooltip && (
            <Info className="h-4 w-4 text-muted-foreground/50" />
          )}
          {!tooltip && icon && (
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center",
              iconColor?.includes("from-") 
                ? `bg-gradient-to-br ${iconColor} text-white` 
                : "bg-primary/10 text-primary"
            )}>
              <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
            </div>
          )}
        </div>

        {/* Value - Large and prominent */}
        <p className="text-3xl font-bold tracking-tight text-foreground mb-1">
          {value}
        </p>

        {/* Trend indicator */}
        {change !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium",
              trendBg,
              trendColor
            )}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(change)}%
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return cardContent;
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
    up: "text-emerald-600 dark:text-emerald-400",
    down: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl bg-card border border-border",
        "transition-all duration-200 hover:shadow-sm",
        className
      )}
    >
      {icon && (
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-foreground">{value}</p>
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
      bar: "bg-primary",
      text: "text-primary",
    },
    success: {
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    warning: {
      bar: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    },
    danger: {
      bar: "bg-red-500",
      text: "text-red-600 dark:text-red-400",
    },
  };

  const colors = colorClasses[color];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center", colors.text)}>
                {icon}
              </div>
            )}
            <span className="text-sm text-muted-foreground">{title}</span>
          </div>
          <span className={cn("text-sm font-medium", colors.text)}>
            {value}{unit} / {max}{unit}
          </span>
        </div>

        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-muted-foreground text-right">
          {percentage.toFixed(0)}% usado
        </p>
      </CardContent>
    </Card>
  );
}
