import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MercuryButton - Button component inspirado en el diseño de Mercury
 * Estilo: Clean, minimalista, con colores azules como acento
 */
export interface MercuryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "text" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const MercuryButton = forwardRef<HTMLButtonElement, MercuryButtonProps>(
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
      "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      fullWidth && "w-full"
    );

    const variants = {
      primary: cn(
        "bg-blue-600 text-white",
        "hover:bg-blue-700",
        "focus:ring-blue-500",
        "shadow-sm hover:shadow"
      ),
      secondary: cn(
        "bg-white text-gray-900 border border-gray-300",
        "hover:bg-gray-50 hover:border-gray-400",
        "focus:ring-gray-500",
        "shadow-sm"
      ),
      outline: cn(
        "border border-gray-300 text-gray-700 bg-transparent",
        "hover:bg-gray-50 hover:border-gray-400",
        "focus:ring-gray-500"
      ),
      ghost: cn(
        "text-gray-700 bg-transparent",
        "hover:bg-gray-100",
        "focus:ring-gray-500"
      ),
      text: cn(
        "text-blue-600 bg-transparent",
        "hover:bg-blue-50",
        "focus:ring-blue-500"
      ),
      danger: cn(
        "bg-red-600 text-white",
        "hover:bg-red-700",
        "focus:ring-red-500",
        "shadow-sm hover:shadow"
      ),
    };

    const sizes = {
      xs: "h-7 px-2.5 text-xs",
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-base",
    };

    const iconSizes = {
      xs: "h-3 w-3",
      sm: "h-3.5 w-3.5",
      md: "h-4 w-4",
      lg: "h-5 w-5",
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

MercuryButton.displayName = "MercuryButton";
