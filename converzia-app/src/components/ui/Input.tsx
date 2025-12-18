import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Control, Controller, FieldValues, Path } from "react-hook-form";

// ============================================
// Input Component - Clean, Modern Design
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
  optional?: boolean;
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
      optional = false,
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
      md: "h-4 w-4",
      lg: "h-5 w-5",
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            {label}
            {props.required && (
              <span className="text-[var(--error)] ml-0.5">*</span>
            )}
            {optional && (
              <span className="text-[var(--text-tertiary)] font-normal ml-1">
                (opcional)
              </span>
            )}
          </label>
        )}

        <div className="relative flex">
          {leftAddon && (
            <div className="flex items-center px-3 rounded-l-lg border border-r-0 border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-sm">
              {leftAddon}
            </div>
          )}

          <div className="relative flex-1">
            {leftIcon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                <span className={iconSizes[inputSize]}>{leftIcon}</span>
              </div>
            )}

            <input
              ref={ref}
              id={inputId}
              className={cn(
                "w-full rounded-lg border bg-[var(--bg-primary)]",
                "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 focus:border-[var(--accent-primary)]",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-tertiary)]",
                sizes[inputSize],
                leftIcon ? "pl-10" : "pl-4",
                rightIcon ? "pr-10" : "pr-4",
                leftAddon && "rounded-l-none",
                rightAddon && "rounded-r-none",
                error
                  ? "border-[var(--error)] focus:ring-[var(--error)] focus:border-[var(--error)]"
                  : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]",
                className
              )}
              {...props}
            />

            {rightIcon && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                <span className={iconSizes[inputSize]}>{rightIcon}</span>
              </div>
            )}
          </div>

          {rightAddon && (
            <div className="flex items-center px-3 rounded-r-lg border border-l-0 border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-sm">
              {rightAddon}
            </div>
          )}
        </div>

        {(error || hint) && (
          <p
            className={cn(
              "mt-1.5 text-sm",
              error ? "text-[var(--error)]" : "text-[var(--text-tertiary)]"
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
