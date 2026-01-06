"use client";

import { ReactNode, forwardRef } from "react";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// MobileCard - Optimized card for mobile lists
// Replaces table rows with touch-friendly cards
// ============================================

export interface MobileCardStat {
  icon: LucideIcon;
  value: string | number;
  label?: string;
}

export interface MobileCardProps {
  // Layout
  avatar?: ReactNode;
  title: string;
  subtitle?: string;
  
  // Content
  badges?: ReactNode;
  stats?: MobileCardStat[];
  metadata?: string;
  footer?: ReactNode;
  
  // Right side
  rightContent?: ReactNode;
  showChevron?: boolean;
  
  // Interaction
  onPress?: () => void;
  onLongPress?: () => void;
  
  // Styling
  variant?: "default" | "highlight" | "muted";
  className?: string;
  isSelected?: boolean;
}

export const MobileCard = forwardRef<HTMLDivElement, MobileCardProps>(
  (
    {
      avatar,
      title,
      subtitle,
      badges,
      stats,
      metadata,
      footer,
      rightContent,
      showChevron = true,
      onPress,
      onLongPress,
      variant = "default",
      className,
      isSelected = false,
    },
    ref
  ) => {
    const handleLongPress = () => {
      if (onLongPress) {
        onLongPress();
      }
    };

    const variants = {
      default: "bg-card border-border",
      highlight: "bg-primary/5 border-primary/20",
      muted: "bg-muted/50 border-muted",
    };

    return (
      <div
        ref={ref}
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={onPress}
        onContextMenu={(e) => {
          if (onLongPress) {
            e.preventDefault();
            handleLongPress();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onPress) {
            onPress();
          }
        }}
        className={cn(
          "relative rounded-xl border p-4 transition-all duration-200",
          variants[variant],
          onPress && [
            "cursor-pointer",
            "active:scale-[0.98] active:bg-muted/50",
            "hover:border-border/80 hover:shadow-sm",
          ],
          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          className
        )}
      >
        {/* Main content row */}
        <div className="flex items-start gap-3">
          {/* Avatar/Icon */}
          {avatar && (
            <div className="flex-shrink-0">
              {avatar}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Right content or chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {rightContent}
                {showChevron && onPress && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Badges */}
            {badges && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {badges}
              </div>
            )}

            {/* Stats row */}
            {stats && stats.length > 0 && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground"
                      title={stat.label}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{stat.value}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Metadata */}
            {metadata && (
              <p className="text-xs text-muted-foreground mt-2">
                {metadata}
              </p>
            )}
          </div>
        </div>

        {/* Optional footer */}
        {footer && (
          <div className="mt-3 pt-3 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

MobileCard.displayName = "MobileCard";

// ============================================
// MobileCardSkeleton - Loading state
// ============================================

export function MobileCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 animate-pulse",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />

        <div className="flex-1 space-y-2">
          {/* Title */}
          <div className="h-5 w-3/4 bg-muted rounded" />
          {/* Subtitle */}
          <div className="h-4 w-1/2 bg-muted rounded" />
          {/* Badges */}
          <div className="flex gap-2 pt-1">
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-5 w-20 bg-muted rounded-full" />
          </div>
          {/* Stats */}
          <div className="flex gap-4 pt-2">
            <div className="h-4 w-12 bg-muted rounded" />
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MobileCardList - Container with spacing
// ============================================

interface MobileCardListProps {
  children: ReactNode;
  className?: string;
  gap?: "sm" | "md" | "lg";
}

export function MobileCardList({ children, className, gap = "md" }: MobileCardListProps) {
  const gaps = {
    sm: "space-y-2",
    md: "space-y-3",
    lg: "space-y-4",
  };

  return (
    <div className={cn(gaps[gap], className)}>
      {children}
    </div>
  );
}

// ============================================
// MobileCardAvatar - Standard avatar for cards
// ============================================

interface MobileCardAvatarProps {
  children?: ReactNode;
  icon?: LucideIcon | React.ElementType;
  src?: string;
  alt?: string;
  fallback?: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
}

export function MobileCardAvatar({
  children,
  icon: Icon,
  src,
  alt,
  fallback,
  variant = "default",
  size = "md",
}: MobileCardAvatarProps) {
  const variants = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || ""}
        className={cn(
          "rounded-lg object-cover",
          sizes[size]
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center font-medium",
        variants[variant],
        sizes[size]
      )}
    >
      {children || (Icon ? <Icon className={iconSizes[size]} /> : fallback?.charAt(0).toUpperCase())}
    </div>
  );
}

