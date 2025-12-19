"use client";

import { useState, useRef, useEffect, ReactNode, Fragment } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Dropdown Menu
// ============================================

interface DropdownItem {
  label: string;
  value?: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  align = "right",
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 min-w-[12rem] py-1 bg-card border border-card-border rounded-lg shadow-xl",
            "animate-in fade-in zoom-in-95 duration-150",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, index) =>
            item.divider ? (
              <div
                key={`divider-${index}`}
                className="my-1 h-px bg-card-border"
              />
            ) : (
              <button
                key={item.value || item.label}
                type="button"
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick?.();
                    setIsOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                  item.disabled
                    ? "text-slate-600 cursor-not-allowed"
                    : item.danger
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-slate-300 hover:bg-card-border hover:text-white"
                )}
              >
                {item.icon && <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Action Dropdown (three dots menu)
// ============================================

import { MoreHorizontal, MoreVertical } from "lucide-react";

interface ActionDropdownProps {
  items: DropdownItem[];
  orientation?: "horizontal" | "vertical";
  align?: "left" | "right";
  size?: "sm" | "md";
}

export function ActionDropdown({
  items,
  orientation = "horizontal",
  align = "right",
  size = "md",
}: ActionDropdownProps) {
  const Icon = orientation === "horizontal" ? MoreHorizontal : MoreVertical;
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const buttonSize = size === "sm" ? "p-1" : "p-1.5";

  return (
    <Dropdown
      align={align}
      items={items}
      trigger={
        <button
          type="button"
          className={cn(
            "rounded-lg text-slate-400 hover:text-white hover:bg-card-border transition-colors",
            buttonSize
          )}
        >
          <Icon className={iconSize} />
        </button>
      }
    />
  );
}

// ============================================
// Select Dropdown (for custom selects)
// ============================================

interface SelectDropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
}

interface SelectDropdownProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Seleccionar",
  disabled = false,
  className,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border bg-card text-left",
          "transition-all duration-200",
          disabled
            ? "opacity-50 cursor-not-allowed border-card-border"
            : isOpen
            ? "border-primary-500 ring-2 ring-primary-500"
            : "border-card-border hover:border-slate-600"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selectedOption?.icon && (
            <span className="h-5 w-5 flex-shrink-0">{selectedOption.icon}</span>
          )}
          <span
            className={cn(
              "truncate",
              selectedOption ? "text-white" : "text-slate-500"
            )}
          >
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-500 transition-transform flex-shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 py-1 bg-card border border-card-border rounded-lg shadow-xl max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (!option.disabled) {
                  onChange?.(option.value);
                  setIsOpen(false);
                }
              }}
              disabled={option.disabled}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                option.disabled
                  ? "text-slate-600 cursor-not-allowed"
                  : option.value === value
                  ? "bg-primary-500/10 text-primary-400"
                  : "text-slate-300 hover:bg-card-border hover:text-white"
              )}
            >
              {option.icon && (
                <span className="h-5 w-5 flex-shrink-0">{option.icon}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate">{option.label}</p>
                {option.description && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {option.description}
                  </p>
                )}
              </div>
              {option.value === value && (
                <Check className="h-4 w-4 text-primary-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



