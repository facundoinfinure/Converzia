import { ReactNode, forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * MercuryCard - Card component inspirado en el diseño de Mercury
 * Estilo: Light, minimalista, con bordes sutiles y sombras suaves
 */
export interface MercuryCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "outlined" | "subtle";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  interactive?: boolean;
}

export const MercuryCard = forwardRef<HTMLDivElement, MercuryCardProps>(
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
      default: "bg-white border border-gray-200 shadow-sm",
      elevated: "bg-white border border-gray-200 shadow-md",
      outlined: "bg-transparent border border-gray-200",
      subtle: "bg-gray-50 border border-gray-100",
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

MercuryCard.displayName = "MercuryCard";

// ============================================
// Mercury Card Header
// ============================================

interface MercuryCardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function MercuryCardHeader({ children, className, action }: MercuryCardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between pb-4 border-b border-gray-200",
        className
      )}
    >
      <div className="text-gray-900">{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================
// Mercury Card Title
// ============================================

interface MercuryCardTitleProps {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function MercuryCardTitle({ children, className, as: Tag = "h3" }: MercuryCardTitleProps) {
  return (
    <Tag className={cn("text-lg font-semibold text-gray-900", className)}>
      {children}
    </Tag>
  );
}

// ============================================
// Mercury Card Description
// ============================================

interface MercuryCardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function MercuryCardDescription({ children, className }: MercuryCardDescriptionProps) {
  return (
    <p className={cn("text-sm text-gray-600 mt-1", className)}>{children}</p>
  );
}

// ============================================
// Mercury Card Content
// ============================================

interface MercuryCardContentProps {
  children: ReactNode;
  className?: string;
}

export function MercuryCardContent({ children, className }: MercuryCardContentProps) {
  return <div className={cn("", className)}>{children}</div>;
}

// ============================================
// Mercury Card Footer
// ============================================

interface MercuryCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function MercuryCardFooter({ children, className }: MercuryCardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 pt-4 border-t border-gray-200",
        className
      )}
    >
      {children}
    </div>
  );
}
