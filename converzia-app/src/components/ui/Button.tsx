import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Button Component - Mobile-First, Touch-Friendly
// ============================================

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "link";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  pill?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      pill = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      // Base layout
      "inline-flex items-center justify-center gap-2 font-semibold",
      // Transitions
      "transition-all duration-200 ease-out",
      // Focus states - accessible
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
      // Disabled states
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
      // Touch feedback
      "active:scale-[0.97]",
      // Prevent text selection on tap
      "select-none",
      // Shape
      pill ? "rounded-full" : "rounded-xl",
      // Width
      fullWidth && "w-full"
    );

    const variants = {
      primary: cn(
        "bg-[var(--accent-primary)] text-white",
        "hover:bg-[var(--accent-primary-hover)]",
        "focus-visible:ring-[var(--accent-primary)]",
        "shadow-sm hover:shadow-md",
        // Gradient on hover for premium feel
        "hover:shadow-[var(--accent-primary)]/25"
      ),
      secondary: cn(
        "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
        "border border-[var(--border-primary)]",
        "hover:bg-[var(--bg-secondary)] hover:border-[var(--border-secondary)]",
        "focus-visible:ring-[var(--border-secondary)]"
      ),
      outline: cn(
        "border-2 border-[var(--border-primary)] text-[var(--text-primary)] bg-transparent",
        "hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-secondary)]",
        "focus-visible:ring-[var(--border-secondary)]"
      ),
      ghost: cn(
        "text-[var(--text-secondary)] bg-transparent",
        "hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
        "focus-visible:ring-[var(--border-secondary)]"
      ),
      danger: cn(
        "bg-[var(--error)] text-white",
        "hover:bg-[var(--error-dark)]",
        "focus-visible:ring-[var(--error)]",
        "shadow-sm hover:shadow-md"
      ),
      success: cn(
        "bg-[var(--success)] text-white",
        "hover:bg-[var(--success-dark)]",
        "focus-visible:ring-[var(--success)]",
        "shadow-sm hover:shadow-md"
      ),
      link: cn(
        "text-[var(--accent-primary)] bg-transparent underline-offset-4",
        "hover:underline hover:text-[var(--accent-primary-hover)]",
        "focus-visible:ring-[var(--accent-primary)]",
        "p-0 h-auto"
      ),
    };

    // Touch-friendly sizes (minimum 44px height on mobile)
    const sizes = {
      xs: "h-8 px-3 text-xs min-h-[32px]",
      sm: "h-9 px-3.5 text-sm min-h-[36px]",
      md: "h-11 px-5 text-sm min-h-[44px]", // Mobile-friendly default
      lg: "h-12 px-6 text-base min-h-[48px]",
      xl: "h-14 px-8 text-base min-h-[56px]",
    };

    const iconSizes = {
      xs: "h-3 w-3",
      sm: "h-3.5 w-3.5",
      md: "h-4 w-4",
      lg: "h-5 w-5",
      xl: "h-5 w-5",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles, 
          variants[variant], 
          variant !== "link" && sizes[size], 
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={cn("animate-spin", iconSizes[size])} />
        ) : (
          leftIcon && <span className={cn("flex-shrink-0", iconSizes[size])}>{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className={cn("flex-shrink-0", iconSizes[size])}>{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// ============================================
// Icon Button - Touch-Friendly
// ============================================

export interface IconButtonProps extends Omit<ButtonProps, "leftIcon" | "rightIcon" | "children"> {
  icon: ReactNode;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "md", className, variant = "ghost", ...props }, ref) => {
    // Touch-friendly sizes (minimum 44px)
    const sizes = {
      xs: "h-8 w-8 min-h-[32px] min-w-[32px]",
      sm: "h-9 w-9 min-h-[36px] min-w-[36px]",
      md: "h-11 w-11 min-h-[44px] min-w-[44px]",
      lg: "h-12 w-12 min-h-[48px] min-w-[48px]",
      xl: "h-14 w-14 min-h-[56px] min-w-[56px]",
    };

    const iconSizes = {
      xs: "h-4 w-4",
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-5 w-5",
      xl: "h-6 w-6",
    };

    return (
      <Button
        ref={ref}
        size={size}
        variant={variant}
        className={cn(
          sizes[size], 
          "p-0 rounded-xl",
          "[&>span]:flex [&>span]:items-center [&>span]:justify-center",
          className
        )}
        {...props}
      >
        <span className={iconSizes[size]}>{icon}</span>
      </Button>
    );
  }
);

IconButton.displayName = "IconButton";

// ============================================
// Button Group
// ============================================

interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <div className={cn(
        "inline-flex overflow-hidden",
        "border border-[var(--border-primary)] rounded-xl",
        "divide-x divide-[var(--border-primary)]",
        "[&>button]:rounded-none [&>button]:border-0"
      )}>
        {children}
      </div>
    </div>
  );
}

// ============================================
// Action Button Group (for row actions)
// ============================================

interface ActionButtonProps {
  children: ReactNode;
  className?: string;
  gap?: "sm" | "md" | "lg";
}

export function ActionButtons({ children, className, gap = "sm" }: ActionButtonProps) {
  const gaps = {
    sm: "gap-1.5",
    md: "gap-2",
    lg: "gap-3",
  };
  
  return (
    <div className={cn("flex items-center flex-wrap", gaps[gap], className)}>
      {children}
    </div>
  );
}
