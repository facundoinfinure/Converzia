import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Button Component
// ============================================

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
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
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      fullWidth && "w-full"
    );

    const variants = {
      primary: cn(
        "bg-gradient-to-r from-primary-500 to-primary-600 text-white",
        "hover:from-primary-600 hover:to-primary-700",
        "focus:ring-primary-500",
        "shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30"
      ),
      secondary: cn(
        "bg-card text-white border border-card-border",
        "hover:bg-card-border hover:border-slate-600",
        "focus:ring-slate-500"
      ),
      outline: cn(
        "border border-card-border text-slate-300 bg-transparent",
        "hover:bg-card-border hover:text-white",
        "focus:ring-slate-500"
      ),
      ghost: cn(
        "text-slate-400 bg-transparent",
        "hover:bg-card-border hover:text-white",
        "focus:ring-slate-500"
      ),
      danger: cn(
        "bg-red-500/20 text-red-400 border border-red-500/30",
        "hover:bg-red-500/30 hover:text-red-300",
        "focus:ring-red-500"
      ),
      success: cn(
        "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        "hover:bg-emerald-500/30 hover:text-emerald-300",
        "focus:ring-emerald-500"
      ),
    };

    const sizes = {
      xs: "h-7 px-2.5 text-xs",
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-base",
      xl: "h-12 px-6 text-base",
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
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={cn("animate-spin", iconSizes[size])} />
        ) : (
          leftIcon && <span className={iconSizes[size]}>{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className={iconSizes[size]}>{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// ============================================
// Icon Button
// ============================================

export interface IconButtonProps extends Omit<ButtonProps, "leftIcon" | "rightIcon" | "children"> {
  icon: ReactNode;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "md", className, ...props }, ref) => {
    const sizes = {
      xs: "h-7 w-7",
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-11 w-11",
      xl: "h-12 w-12",
    };

    return (
      <Button
        ref={ref}
        size={size}
        className={cn(sizes[size], "p-0", className)}
        {...props}
      >
        {icon}
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
      <div className="inline-flex rounded-lg overflow-hidden border border-card-border divide-x divide-card-border">
        {children}
      </div>
    </div>
  );
}

