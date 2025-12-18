"use client";

import { ReactNode, forwardRef, HTMLAttributes, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Card Component - Clean, Modern Design
// ============================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "ghost" | "highlight";
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
      default: "bg-[var(--bg-primary)] border border-[var(--border-primary)]",
      elevated: "bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-[var(--shadow-md)]",
      outlined: "bg-transparent border border-[var(--border-primary)]",
      ghost: "bg-transparent",
      highlight: "bg-[var(--accent-primary-light)] border border-[var(--accent-primary-muted)]",
    };

    const paddings = {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
      xl: "p-8",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl transition-all duration-200",
          variants[variant],
          paddings[padding],
          hover && "hover:border-[var(--border-secondary)]",
          interactive && "cursor-pointer hover:shadow-[var(--shadow-sm)] active:scale-[0.99]",
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
        "flex items-center justify-between px-6 py-4",
        !noBorder && "border-b border-[var(--border-primary)]",
        className
      )}
    >
      <div className="flex-1">{children}</div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
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
    sm: "text-base font-medium",
    md: "text-lg font-semibold",
    lg: "text-xl font-semibold",
  };
  
  return (
    <Tag className={cn(sizes[size], "text-[var(--text-primary)]", className)}>
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
// Card Content
// ============================================

interface CardContentProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CardContent({ children, className, noPadding = false }: CardContentProps) {
  return (
    <div className={cn(!noPadding && "p-6", className)}>
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
        "flex items-center gap-3 px-6 py-4",
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
    <div className={cn("py-6 first:pt-0 last:pb-0", className)}>
      {(title || description || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h4 className="text-sm font-medium text-[var(--text-primary)]">
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
        className="w-full flex items-center justify-between p-6 text-left group"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex-shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-6 pb-6 border-t border-[var(--border-primary)] pt-6">
          {children}
        </div>
      </div>
    </Card>
  );
}

