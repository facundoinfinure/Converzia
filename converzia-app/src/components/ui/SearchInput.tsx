"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

// ============================================
// Search Input Component
// ============================================

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isLoading?: boolean;
  autoFocus?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SearchInput({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = "Buscar...",
  debounceMs = 300,
  isLoading = false,
  autoFocus = false,
  size = "md",
  className,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue || "");
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceMs <= 0 || !onSearch) return;

    const timer = setTimeout(() => {
      onSearch(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs, onSearch]);

  const handleChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleClear = () => {
    handleChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch?.(value);
    }
    if (e.key === "Escape") {
      handleClear();
    }
  };

  const sizes = {
    sm: "h-8 text-sm pl-8 pr-8",
    md: "h-10 text-sm pl-10 pr-10",
    lg: "h-12 text-base pl-12 pr-12",
  };

  const iconSizes = {
    sm: "h-4 w-4 left-2",
    md: "h-5 w-5 left-3",
    lg: "h-5 w-5 left-4",
  };

  const clearSizes = {
    sm: "right-2",
    md: "right-3",
    lg: "right-4",
  };

  return (
    <div className={cn("relative", className)}>
      <Search
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-slate-500",
          iconSizes[size]
        )}
      />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "w-full rounded-lg border border-card-border bg-card text-white placeholder-slate-500",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
          sizes[size]
        )}
      />

      {/* Clear button or loading spinner */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2",
          clearSizes[size]
        )}
      >
        {isLoading ? (
          <Spinner size="sm" color="slate" />
        ) : value ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-card-border transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ============================================
// Search Input with Filters
// ============================================

interface SearchWithFiltersProps extends SearchInputProps {
  filters?: React.ReactNode;
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
}

export function SearchWithFilters({
  filters,
  filtersOpen,
  onToggleFilters,
  ...searchProps
}: SearchWithFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SearchInput {...searchProps} className="flex-1" />
        {filters && onToggleFilters && (
          <button
            type="button"
            onClick={onToggleFilters}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
              filtersOpen
                ? "bg-primary-500/20 text-primary-400 border-primary-500/30"
                : "bg-card text-slate-400 border-card-border hover:text-white hover:border-slate-600"
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filtros
          </button>
        )}
      </div>

      {filtersOpen && filters && (
        <div className="p-4 rounded-lg bg-card border border-card-border">
          {filters}
        </div>
      )}
    </div>
  );
}

// ============================================
// Command Palette Search (for global search)
// ============================================

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  results?: Array<{
    id: string;
    title: string;
    description?: string;
    icon?: React.ReactNode;
    category?: string;
    action?: () => void;
  }>;
  isLoading?: boolean;
  placeholder?: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSearch,
  results = [],
  isLoading = false,
  placeholder = "Buscar en todo...",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Command palette */}
      <div className="relative w-full max-w-2xl bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-200">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 h-14 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none text-base"
          />
          {isLoading && <Spinner size="sm" />}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-[400px] overflow-auto p-2">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => {
                  result.action?.();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-gray-50 transition-colors group"
              >
                {result.icon && (
                  <span className="h-5 w-5 text-gray-400 group-hover:text-gray-600">{result.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                  {result.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {result.description}
                    </p>
                  )}
                </div>
                {result.category && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{result.category}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query && !isLoading && results.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No se encontraron resultados para &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-medium">↵</kbd>
            <span>para seleccionar</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-medium">↑↓</kbd>
            <span>para navegar</span>
          </span>
        </div>
      </div>
    </div>
  );
}

