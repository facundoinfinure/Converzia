"use client";

import { ReactNode, forwardRef, HTMLAttributes, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Card Component - Mobile-First, Modern Design
// ============================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "ghost" | "highlight" | "gradient";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  hover?: boolean;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = "default",
      padding = "none",
      hover = false,
      interactive = false,
      className,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-[var(--shadow-card)]",
      elevated: "bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-[var(--shadow-lg)]",
      outlined: "bg-transparent border border-[var(--border-primary)]",
      ghost: "bg-transparent",
      highlight: "bg-[var(--accent-primary-light)] border border-[var(--accent-primary-muted)]",
      gradient: cn(
        "bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-tertiary)]",
        "border border-[var(--border-primary)]"
      ),
    };

    // Mobile-friendly padding
    const paddings = {
      none: "",
      sm: "p-4",
      md: "p-5 lg:p-6",
      lg: "p-6 lg:p-8",
      xl: "p-8 lg:p-10",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl transition-all duration-200",
          variants[variant],
          paddings[padding],
          hover && "hover:border-[var(--border-secondary)] hover:shadow-[var(--shadow-md)]",
          interactive && cn(
            "cursor-pointer",
            "hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5",
            "active:scale-[0.99] active:translate-y-0"
          ),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// ============================================
// Card Header - Mobile-First
// ============================================

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  noBorder?: boolean;
}

export function CardHeader({ children, className, action, noBorder = false }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        // Mobile-first padding
        "px-4 py-4 sm:px-6",
        !noBorder && "border-b border-[var(--border-primary)]",
        className
      )}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ============================================
// Card Title - Mobile-First
// ============================================

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  size?: "sm" | "md" | "lg";
}

export function CardTitle({ children, className, as: Tag = "h3", size = "md" }: CardTitleProps) {
  const sizes = {
    sm: "text-base font-semibold",
    md: "text-lg font-semibold",
    lg: "text-xl font-bold",
  };
  
  return (
    <Tag className={cn(
      sizes[size], 
      "text-[var(--text-primary)] font-[var(--font-display)] tracking-tight",
      className
    )}>
      {children}
    </Tag>
  );
}

// ============================================
// Card Description
// ============================================

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn("text-sm text-[var(--text-secondary)] mt-1", className)}>
      {children}
    </p>
  );
}

// ============================================
// Card Content - Mobile-First
// ============================================

interface CardContentProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CardContent({ children, className, noPadding = false }: CardContentProps) {
  return (
    <div className={cn(!noPadding && "p-4 sm:p-6", className)}>
      {children}
    </div>
  );
}

// ============================================
// Card Footer - Mobile-First
// ============================================

interface CardFooterProps {
  children: ReactNode;
  className?: string;
  noBorder?: boolean;
  align?: "left" | "center" | "right" | "between";
}

export function CardFooter({ 
  children, 
  className, 
  noBorder = false,
  align = "right" 
}: CardFooterProps) {
  const alignments = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
    between: "justify-between",
  };
  
  return (
    <div
      className={cn(
        "flex items-center gap-3 flex-wrap",
        // Mobile-first padding
        "px-4 py-4 sm:px-6",
        !noBorder && "border-t border-[var(--border-primary)]",
        alignments[align],
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// Card Section (for grouping content)
// ============================================

interface CardSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}

export function CardSection({
  children,
  title,
  description,
  className,
  action,
}: CardSectionProps) {
  return (
    <div className={cn("py-5 first:pt-0 last:pb-0", className)}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                {title}
              </h4>
            )}
            {description && (
              <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================
// Collapsible Card - Touch-Friendly
// ============================================

interface CollapsibleCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function CollapsibleCard({
  title,
  description,
  children,
  defaultOpen = false,
  className,
  icon,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-4 text-left group",
          // Touch-friendly padding and min-height
          "p-4 sm:p-6 min-h-[56px]",
          "transition-colors duration-200",
          "active:bg-[var(--bg-tertiary)]"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="flex-shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className={cn(
          "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg",
          "bg-[var(--bg-tertiary)] group-hover:bg-[var(--accent-primary-light)]",
          "transition-all duration-200"
        )}>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-300",
              isOpen && "rotate-180",
              "group-hover:text-[var(--accent-primary)]"
            )}
          />
        </div>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 border-t border-[var(--border-primary)] pt-4 sm:pt-6">
          {children}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Stat Card - Mobile Optimized
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down";
  };
  icon?: ReactNode;
  iconColor?: "primary" | "success" | "warning" | "error" | "info";
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  change,
  icon,
  iconColor = "primary",
  className,
  onClick,
}: StatCardProps) {
  const iconColors = {
    primary: "bg-[var(--accent-primary-light)] text-[var(--accent-primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    error: "bg-[var(--error-light)] text-[var(--error)]",
    info: "bg-[var(--info-light)] text-[var(--info)]",
  };

  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cn("p-4 sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-tertiary)] font-medium truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1 font-[var(--font-display)]">
            {value}
          </p>
          {change && (
            <p className={cn(
              "text-sm font-medium mt-1",
              change.trend === "up" ? "text-[var(--success)]" : "text-[var(--error)]"
            )}>
              {change.trend === "up" ? "↑" : "↓"} {Math.abs(change.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
            iconColors[iconColor]
          )}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
