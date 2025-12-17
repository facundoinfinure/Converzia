import { forwardRef, InputHTMLAttributes } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Checkbox Component
// ============================================

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
  description?: string;
  error?: string;
  indeterminate?: boolean;
  size?: "sm" | "md" | "lg";
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      error,
      indeterminate = false,
      size = "md",
      id,
      checked,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const sizes = {
      sm: {
        box: "h-4 w-4",
        icon: "h-3 w-3",
        label: "text-sm",
        description: "text-xs",
      },
      md: {
        box: "h-5 w-5",
        icon: "h-3.5 w-3.5",
        label: "text-sm",
        description: "text-sm",
      },
      lg: {
        box: "h-6 w-6",
        icon: "h-4 w-4",
        label: "text-base",
        description: "text-sm",
      },
    };

    return (
      <div className={cn("flex items-start gap-3", className)}>
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              "rounded border-2 transition-all duration-200",
              "peer-focus:ring-2 peer-focus:ring-primary-500 peer-focus:ring-offset-2 peer-focus:ring-offset-background",
              "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
              sizes[size].box,
              checked || indeterminate
                ? "bg-primary-500 border-primary-500"
                : error
                ? "border-red-500 bg-transparent"
                : "border-card-border bg-transparent peer-hover:border-slate-500"
            )}
          />
          {(checked || indeterminate) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {indeterminate ? (
                <Minus className={cn("text-white", sizes[size].icon)} />
              ) : (
                <Check className={cn("text-white", sizes[size].icon)} />
              )}
            </div>
          )}
        </div>

        {(label || description) && (
          <div className="flex-1 pt-0.5">
            {label && (
              <label
                htmlFor={checkboxId}
                className={cn(
                  "font-medium text-slate-300 cursor-pointer",
                  props.disabled && "cursor-not-allowed opacity-50",
                  sizes[size].label
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p
                className={cn(
                  "text-slate-500 mt-0.5",
                  sizes[size].description
                )}
              >
                {description}
              </p>
            )}
            {error && (
              <p className="text-red-400 text-sm mt-0.5">{error}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

// ============================================
// Checkbox Group
// ============================================

interface CheckboxGroupProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function CheckboxGroup({
  label,
  error,
  children,
  orientation = "vertical",
  className,
}: CheckboxGroupProps) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <p className="text-sm font-medium text-slate-300 mb-3">{label}</p>
      )}
      <div
        className={cn(
          "flex gap-3",
          orientation === "vertical" ? "flex-col" : "flex-wrap"
        )}
      >
        {children}
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

