import { ReactNode, forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * LightCard - Card component con estilo light y minimalista
 * Estilo: Light, minimalista, con bordes sutiles y sombras suaves
 */
export interface LightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "subtle";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  interactive?: boolean;
}

export const LightCard = forwardRef<HTMLDivElement, LightCardProps>(
  (
    {
      children,
      variant = "default",
      padding = "md",
      hover = false,
      interactive = false,
      className,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm",
      elevated: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-md",
      outlined: "bg-transparent border border-gray-200 dark:border-slate-700",
      subtle: "bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700",
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
          "rounded-lg transition-all duration-200",
          variants[variant],
          paddings[padding],
          hover && "hover:shadow-md hover:border-gray-300",
          interactive && "cursor-pointer hover:shadow-md hover:border-gray-300",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

LightCard.displayName = "LightCard";

// ============================================
// Light Card Header
// ============================================

interface LightCardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function LightCardHeader({ children, className, action }: LightCardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between pb-4 border-b border-gray-200 dark:border-slate-700",
        className
      )}
    >
      <div className="text-gray-900 dark:text-slate-100">{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================
// Light Card Title
// ============================================

interface LightCardTitleProps {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function LightCardTitle({ children, className, as: Tag = "h3" }: LightCardTitleProps) {
  return (
    <Tag className={cn("text-lg font-semibold text-gray-900 dark:text-slate-100", className)}>
      {children}
    </Tag>
  );
}

// ============================================
// Light Card Description
// ============================================

interface LightCardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function LightCardDescription({ children, className }: LightCardDescriptionProps) {
  return (
    <p className={cn("text-sm text-gray-600 dark:text-slate-400 mt-1", className)}>{children}</p>
  );
}

// ============================================
// Light Card Content
// ============================================

interface LightCardContentProps {
  children: ReactNode;
  className?: string;
}

export function LightCardContent({ children, className }: LightCardContentProps) {
  return <div className={cn("", className)}>{children}</div>;
}

// ============================================
// Light Card Footer
// ============================================

interface LightCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function LightCardFooter({ children, className }: LightCardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700",
        className
      )}
    >
      {children}
    </div>
  );
}
