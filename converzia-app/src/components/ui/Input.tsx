import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Control, Controller, FieldValues, Path } from "react-hook-form";

// ============================================
// Input Component - Mobile-First, Touch-Friendly
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

    // Touch-friendly sizes (minimum 44px for accessibility)
    const sizes = {
      sm: "h-10 text-sm min-h-[40px]",
      md: "h-12 text-base min-h-[48px]", // Mobile-friendly default
      lg: "h-14 text-base min-h-[56px]",
    };

    const iconSizes = {
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-5 w-5",
    };

    const iconPadding = {
      sm: "pl-10",
      md: "pl-12",
      lg: "pl-14",
    };

    const rightIconPadding = {
      sm: "pr-10",
      md: "pr-12",
      lg: "pr-14",
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-[var(--text-primary)] mb-2"
          >
            {label}
            {props.required && (
              <span className="text-[var(--error)] ml-0.5">*</span>
            )}
            {optional && (
              <span className="text-[var(--text-tertiary)] font-normal text-xs ml-1.5">
                (opcional)
              </span>
            )}
          </label>
        )}

        <div className="relative flex">
          {leftAddon && (
            <div className={cn(
              "flex items-center px-4 rounded-l-xl border border-r-0",
              "border-[var(--border-primary)] bg-[var(--bg-tertiary)]",
              "text-[var(--text-secondary)] text-sm font-medium"
            )}>
              {leftAddon}
            </div>
          )}

          <div className="relative flex-1">
            {leftIcon && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none">
                <span className={cn("flex items-center justify-center", iconSizes[inputSize])}>
                  {leftIcon}
                </span>
              </div>
            )}

            <input
              ref={ref}
              id={inputId}
              className={cn(
                // Base styles
                "w-full rounded-xl border-2 bg-[var(--bg-primary)]",
                "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
                "font-medium",
                // Smooth transitions
                "transition-all duration-200 ease-out",
                // Focus states with animation
                "focus:outline-none focus:ring-0 focus:border-[var(--accent-primary)]",
                "focus:shadow-[0_0_0_3px_var(--accent-primary-light)]",
                "focus-ring",
                // Disabled states
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-tertiary)]",
                // Size
                sizes[inputSize],
                // Padding based on icons
                leftIcon ? iconPadding[inputSize] : "pl-4",
                rightIcon ? rightIconPadding[inputSize] : "pr-4",
                // Addon modifications
                leftAddon && "rounded-l-none",
                rightAddon && "rounded-r-none",
                // Error states with animation
                error
                  ? "border-[var(--error)] focus:border-[var(--error)] focus:shadow-[0_0_0_3px_var(--error-light)] animate-shake"
                  : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]",
                className
              )}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
              {...props}
            />

            {rightIcon && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                <span className={cn("flex items-center justify-center", iconSizes[inputSize])}>
                  {rightIcon}
                </span>
              </div>
            )}
          </div>

          {rightAddon && (
            <div className={cn(
              "flex items-center px-4 rounded-r-xl border border-l-0",
              "border-[var(--border-primary)] bg-[var(--bg-tertiary)]",
              "text-[var(--text-secondary)] text-sm font-medium"
            )}>
              {rightAddon}
            </div>
          )}
        </div>

        {(error || hint) && (
          <p
            id={error ? `${inputId}-error` : `${inputId}-hint`}
            role={error ? "alert" : undefined}
            className={cn(
              "mt-2 text-sm transition-all duration-200",
              error 
                ? "text-[var(--error)] font-medium animate-fade-in" 
                : "text-[var(--text-tertiary)]"
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
// Search Input - Touch-Friendly
// ============================================

export interface SearchInputProps extends Omit<InputProps, "leftIcon"> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, value, ...props }, ref) => {
    return (
      <div className="relative">
        <Input
          ref={ref}
          type="search"
          leftIcon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          value={value}
          className={cn(
            "rounded-full",
            // Hide default search cancel button
            "[&::-webkit-search-cancel-button]:hidden",
            className
          )}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpiar búsqueda"
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2",
              "w-6 h-6 flex items-center justify-center rounded-full",
              "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]",
              "hover:bg-[var(--accent-primary-light)] hover:text-[var(--accent-primary)]",
              "transition-colors duration-200 focus-ring"
            )}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

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
