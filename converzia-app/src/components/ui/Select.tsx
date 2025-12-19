"use client";

import { forwardRef, SelectHTMLAttributes, useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Native Select Component - Clean, Modern Design
// ============================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  selectSize?: "sm" | "md" | "lg";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      hint,
      options,
      placeholder,
      selectSize = "md",
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const sizes = {
      sm: "h-8 text-sm",
      md: "h-10 text-sm",
      lg: "h-12 text-base",
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            {label}
            {props.required && <span className="text-[var(--error)] ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "w-full appearance-none rounded-lg border bg-[var(--bg-primary)]",
              "text-[var(--text-primary)] px-4 pr-10",
              "transition-all duration-200 cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-tertiary)]",
              sizes[selectSize],
              error
                ? "border-[var(--error)] focus:ring-[var(--error)] focus:border-[var(--error)]"
                : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)] pointer-events-none" />
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

Select.displayName = "Select";

// ============================================
// Custom Dropdown Select (for more control)
// ============================================

interface CustomSelectProps {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CustomSelect({
  label,
  error,
  hint,
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  disabled = false,
  required = false,
  className,
  size = "md",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const sizes = {
    sm: "h-8 text-sm",
    md: "h-10 text-sm",
    lg: "h-12 text-base",
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {label}
          {required && <span className="text-[var(--error)] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between rounded-lg border bg-[var(--bg-primary)] px-4",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]",
            disabled && "opacity-50 cursor-not-allowed bg-[var(--bg-tertiary)]",
            sizes[size],
            error
              ? "border-[var(--error)]"
              : isOpen
              ? "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]"
              : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]",
            className
          )}
          disabled={disabled}
        >
          <span className={selectedOption ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[var(--text-tertiary)] transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-[var(--z-dropdown)] w-full mt-1 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-[var(--shadow-lg)] max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange?.(option.value);
                  setIsOpen(false);
                }}
                disabled={option.disabled}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2 text-left text-sm",
                  "transition-colors duration-150",
                  option.disabled
                    ? "text-[var(--text-tertiary)] cursor-not-allowed"
                    : option.value === value
                    ? "text-[var(--accent-primary)] bg-[var(--accent-primary-light)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                )}
              >
                {option.label}
                {option.value === value && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {(error || hint) && (
        <p className={cn("mt-1.5 text-sm", error ? "text-[var(--error)]" : "text-[var(--text-tertiary)]")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

// ============================================
// Multi Select
// ============================================

interface MultiSelectProps {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  max?: number;
}

export function MultiSelect({
  label,
  error,
  hint,
  options,
  value = [],
  onChange,
  placeholder = "Seleccionar...",
  disabled = false,
  required = false,
  className,
  max,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : max && value.length >= max
      ? value
      : [...value, optionValue];
    onChange?.(newValue);
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(value.filter((v) => v !== optionValue));
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {label}
          {required && <span className="text-[var(--error)] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full min-h-10 flex items-center flex-wrap gap-1.5 rounded-lg border bg-[var(--bg-primary)] px-3 py-2",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]",
            disabled && "opacity-50 cursor-not-allowed bg-[var(--bg-tertiary)]",
            error
              ? "border-[var(--error)]"
              : isOpen
              ? "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]"
              : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]",
            className
          )}
          disabled={disabled}
        >
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-primary-light)] text-[var(--accent-primary)] text-sm"
              >
                {option.label}
                <X
                  className="h-3 w-3 cursor-pointer hover:opacity-70"
                  onClick={(e) => removeOption(option.value, e)}
                />
              </span>
            ))
          ) : (
            <span className="text-[var(--text-tertiary)] text-sm">{placeholder}</span>
          )}
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 text-[var(--text-tertiary)] transition-transform flex-shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-[var(--z-dropdown)] w-full mt-1 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-[var(--shadow-lg)] max-h-60 overflow-auto">
            {options.map((option) => {
              const isSelected = value.includes(option.value);
              const isMaxed = max && value.length >= max && !isSelected;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  disabled={Boolean(option.disabled || isMaxed)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2 text-left text-sm",
                    "transition-colors duration-150",
                    option.disabled || isMaxed
                      ? "text-[var(--text-tertiary)] cursor-not-allowed"
                      : isSelected
                      ? "text-[var(--accent-primary)] bg-[var(--accent-primary-light)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  )}
                >
                  {option.label}
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(error || hint) && (
        <p className={cn("mt-1.5 text-sm", error ? "text-[var(--error)]" : "text-[var(--text-tertiary)]")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}



