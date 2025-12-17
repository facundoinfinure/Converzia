import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================
// Input Component
// ============================================

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  inputSize?: "sm" | "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      leftAddon,
      rightAddon,
      inputSize = "md",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const sizes = {
      sm: "h-8 text-sm",
      md: "h-10 text-sm",
      lg: "h-12 text-base",
    };

    const iconSizes = {
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-5 w-5",
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}

        <div className="relative flex">
          {leftAddon && (
            <div className="flex items-center px-3 rounded-l-lg border border-r-0 border-card-border bg-card text-slate-400 text-sm">
              {leftAddon}
            </div>
          )}

          <div className="relative flex-1">
            {leftIcon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <span className={iconSizes[inputSize]}>{leftIcon}</span>
              </div>
            )}

            <input
              ref={ref}
              id={inputId}
              className={cn(
                "w-full rounded-lg border bg-card text-white placeholder-slate-500",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-card-border",
                sizes[inputSize],
                leftIcon ? "pl-10" : "pl-4",
                rightIcon ? "pr-10" : "pr-4",
                leftAddon && "rounded-l-none",
                rightAddon && "rounded-r-none",
                error
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-card-border",
                className
              )}
              {...props}
            />

            {rightIcon && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <span className={iconSizes[inputSize]}>{rightIcon}</span>
              </div>
            )}
          </div>

          {rightAddon && (
            <div className="flex items-center px-3 rounded-r-lg border border-l-0 border-card-border bg-card text-slate-400 text-sm">
              {rightAddon}
            </div>
          )}
        </div>

        {(error || hint) && (
          <p
            className={cn(
              "mt-1.5 text-sm",
              error ? "text-red-400" : "text-slate-500"
            )}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// ============================================
// Form Input (with react-hook-form support)
// ============================================

import { Control, Controller, FieldValues, Path } from "react-hook-form";

interface FormInputProps<T extends FieldValues> extends Omit<InputProps, "name"> {
  name: Path<T>;
  control: Control<T>;
}

export function FormInput<T extends FieldValues>({
  name,
  control,
  ...props
}: FormInputProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Input
          {...field}
          {...props}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

