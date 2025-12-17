import { ReactNode, forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Card Component
// ============================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "ghost";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = "default",
      padding = "none",
      hover = false,
      className,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "bg-card border border-card-border",
      elevated: "bg-card border border-card-border shadow-xl shadow-black/20",
      outlined: "bg-transparent border border-card-border",
      ghost: "bg-transparent",
    };

    const paddings = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl",
          variants[variant],
          paddings[padding],
          hover && "transition-all duration-200 hover:border-slate-600 hover:shadow-lg cursor-pointer",
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
}

export function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-4 border-b border-card-border",
        className
      )}
    >
      <div>{children}</div>
      {action && <div>{action}</div>}
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
}

export function CardTitle({ children, className, as: Tag = "h3" }: CardTitleProps) {
  return (
    <Tag className={cn("text-lg font-semibold text-white", className)}>
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
    <p className={cn("text-sm text-slate-400 mt-1", className)}>{children}</p>
  );
}

// ============================================
// Card Content
// ============================================

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

// ============================================
// Card Footer
// ============================================

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 px-6 py-4 border-t border-card-border",
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
}

export function CardSection({
  children,
  title,
  description,
  className,
}: CardSectionProps) {
  return (
    <div className={cn("py-6 first:pt-0 last:pb-0", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h4 className="text-sm font-medium text-white">{title}</h4>}
          {description && (
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================
// Collapsible Card
// ============================================

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleCard({
  title,
  description,
  children,
  defaultOpen = false,
  className,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && (
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="px-6 pb-6 border-t border-card-border pt-6">
          {children}
        </div>
      )}
    </Card>
  );
}

