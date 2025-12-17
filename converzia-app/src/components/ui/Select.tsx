"use client";

import { forwardRef, SelectHTMLAttributes, ReactNode, useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Native Select Component
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
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "w-full appearance-none rounded-lg border bg-card text-white px-4 pr-10",
              "transition-all duration-200 cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              sizes[selectSize],
              error
                ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                : "border-card-border",
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

          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
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
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between rounded-lg border bg-card px-4",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
            disabled && "opacity-50 cursor-not-allowed",
            sizes[size],
            error
              ? "border-red-500"
              : isOpen
              ? "border-primary-500 ring-2 ring-primary-500"
              : "border-card-border",
            className
          )}
          disabled={disabled}
        >
          <span className={selectedOption ? "text-white" : "text-slate-500"}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-500 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 py-1 bg-card border border-card-border rounded-lg shadow-xl max-h-60 overflow-auto">
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
                    ? "text-slate-600 cursor-not-allowed"
                    : option.value === value
                    ? "text-primary-400 bg-primary-500/10"
                    : "text-slate-300 hover:bg-card-border hover:text-white"
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
        <p className={cn("mt-1.5 text-sm", error ? "text-red-400" : "text-slate-500")}>
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
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full min-h-10 flex items-center flex-wrap gap-1.5 rounded-lg border bg-card px-3 py-2",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
            disabled && "opacity-50 cursor-not-allowed",
            error
              ? "border-red-500"
              : isOpen
              ? "border-primary-500 ring-2 ring-primary-500"
              : "border-card-border",
            className
          )}
          disabled={disabled}
        >
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-500/20 text-primary-400 text-sm"
              >
                {option.label}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-primary-300"
                  onClick={(e) => removeOption(option.value, e)}
                />
              </span>
            ))
          ) : (
            <span className="text-slate-500 text-sm">{placeholder}</span>
          )}
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 text-slate-500 transition-transform flex-shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 py-1 bg-card border border-card-border rounded-lg shadow-xl max-h-60 overflow-auto">
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
                      ? "text-slate-600 cursor-not-allowed"
                      : isSelected
                      ? "text-primary-400 bg-primary-500/10"
                      : "text-slate-300 hover:bg-card-border hover:text-white"
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
        <p className={cn("mt-1.5 text-sm", error ? "text-red-400" : "text-slate-500")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

