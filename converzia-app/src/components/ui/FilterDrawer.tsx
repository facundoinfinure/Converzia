"use client";

import { ReactNode, useState } from "react";
import { Filter, X, Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
  DrawerFooter,
} from "./drawer";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";

// ============================================
// FilterDrawer - Bottom sheet for filters
// Mobile-first filter experience
// ============================================

interface FilterDrawerProps {
  trigger?: ReactNode;
  title?: string;
  description?: string;
  children: ReactNode;
  activeCount?: number;
  onApply?: () => void;
  onClear?: () => void;
  applyLabel?: string;
  clearLabel?: string;
}

export function FilterDrawer({
  trigger,
  title = "Filtros",
  description,
  children,
  activeCount = 0,
  onApply,
  onClear,
  applyLabel = "Aplicar filtros",
  clearLabel = "Limpiar todo",
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

  const handleApply = () => {
    setOpen(false);
    onApply?.();
  };

  const handleClear = () => {
    onClear?.();
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Filter className="h-4 w-4" />
      <span>Filtros</span>
      {activeCount > 0 && (
        <Badge variant="primary" size="sm" className="ml-1">
          {activeCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || defaultTrigger}
      </DrawerTrigger>
      
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle>{title}</DrawerTitle>
              {description && (
                <DrawerDescription>{description}</DrawerDescription>
              )}
            </div>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-muted-foreground"
              >
                {clearLabel}
              </Button>
            )}
          </div>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>
        
        <DrawerFooter className="border-t border-border pb-safe">
          <Button onClick={handleApply} className="w-full">
            {applyLabel}
            {activeCount > 0 && ` (${activeCount})`}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ============================================
// FilterSection - Group of related filters
// ============================================

interface FilterSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function FilterSection({ title, children, className }: FilterSectionProps) {
  return (
    <div className={cn("py-4 first:pt-0 last:pb-0", className)}>
      <h4 className="text-sm font-medium text-foreground mb-3">{title}</h4>
      {children}
    </div>
  );
}

// ============================================
// FilterChips - Chip-based filter selection
// ============================================

interface FilterChip {
  value: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  options: FilterChip[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function FilterChips({
  options,
  value,
  onChange,
  multiple = false,
  className,
}: FilterChipsProps) {
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  const handleSelect = (chipValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(chipValue)
        ? selectedValues.filter((v) => v !== chipValue)
        : [...selectedValues, chipValue];
      onChange(newValues);
    } else {
      onChange(selectedValues.includes(chipValue) ? "" : chipValue);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        
        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
              "border transition-all duration-150",
              "active:scale-95",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-primary/50"
            )}
          >
            {isSelected && <Check className="h-3.5 w-3.5" />}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className={cn(
                "text-xs",
                isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// ActiveFilters - Display active filter chips
// ============================================

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function ActiveFilters({
  filters,
  onRemove,
  onClearAll,
  className,
}: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter) => (
        <Badge
          key={filter.key}
          variant="secondary"
          className="gap-1 pr-1"
        >
          <span className="text-muted-foreground">{filter.label}:</span>
          <span>{filter.value}</span>
          <button
            onClick={() => onRemove(filter.key)}
            className="ml-1 p-0.5 rounded-full hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      
      {filters.length > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-2 text-xs text-muted-foreground"
        >
          Limpiar todo
        </Button>
      )}
    </div>
  );
}

// ============================================
// QuickFilters - Horizontal scrollable filters
// For inline filter bar on mobile
// ============================================

interface QuickFilter {
  key: string;
  label: string;
  count?: number;
  highlight?: boolean;
}

interface QuickFiltersProps {
  filters: QuickFilter[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
  className?: string;
}

export function QuickFilters({
  filters,
  activeFilter,
  onFilterChange,
  className,
}: QuickFiltersProps) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide", className)}>
      {filters.map((filter) => {
        const isActive = activeFilter === filter.key;
        
        return (
          <button
            key={filter.key}
            onClick={() => onFilterChange(filter.key)}
            className={cn(
              "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
              "transition-all duration-150 whitespace-nowrap",
              "active:scale-95",
              isActive
                ? filter.highlight
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  : "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs rounded-full",
                isActive && filter.highlight
                  ? "bg-amber-500/30"
                  : isActive
                    ? "bg-primary/20"
                    : "bg-background"
              )}>
                {filter.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

