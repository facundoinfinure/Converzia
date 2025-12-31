"use client";

import { ReactNode, forwardRef, HTMLAttributes, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Card Component - shadcn compatible
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
      default: "bg-card border border-border shadow-sm",
      elevated: "bg-card border border-border shadow-lg",
      outlined: "bg-transparent border border-border",
      ghost: "bg-transparent",
      highlight: "bg-primary/5 border border-primary/20",
      gradient: "bg-gradient-to-br from-card to-muted border border-border",
    };

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
          "rounded-xl transition-all duration-200",
          variants[variant],
          paddings[padding],
          hover && "hover:border-border/80 hover:shadow-md",
          interactive && cn(
            "cursor-pointer",
            "hover:shadow-lg hover:-translate-y-0.5",
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
// Card Header
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
        "px-4 py-4 sm:px-6",
        !noBorder && "border-b border-border",
        className
      )}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ============================================
// Card Title
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
      "text-foreground tracking-tight",
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
    <p className={cn("text-sm text-muted-foreground mt-1", className)}>
      {children}
    </p>
  );
}

// ============================================
// Card Content
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
// Card Footer
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
        "px-4 py-4 sm:px-6",
        !noBorder && "border-t border-border",
        alignments[align],
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// Card Section
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
              <h4 className="text-sm font-semibold text-foreground">
                {title}
              </h4>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">
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
// Collapsible Card
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
          "p-4 sm:p-6 min-h-[56px]",
          "transition-colors duration-200",
          "active:bg-muted/50"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className={cn(
          "flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg",
          "bg-muted group-hover:bg-primary/10",
          "transition-all duration-200"
        )}>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-300",
              isOpen && "rotate-180",
              "group-hover:text-primary"
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
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 border-t border-border pt-4 sm:pt-6">
          {children}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Simple Stat Card (legacy compatibility)
// ============================================

interface SimpleStatCardProps {
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

export function SimpleStatCard({
  title,
  value,
  change,
  icon,
  iconColor = "primary",
  className,
  onClick,
}: SimpleStatCardProps) {
  const iconColors = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/10 text-red-600 dark:text-red-400",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cn("p-4 sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground font-medium truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 tracking-tight">
            {value}
          </p>
          {change && (
            <p className={cn(
              "text-sm font-medium mt-1",
              change.trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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
