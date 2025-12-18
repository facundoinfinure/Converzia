"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./Checkbox";
import { Skeleton } from "./Skeleton";

// ============================================
// Table Types
// ============================================

export interface Column<T> {
  key: string;
  header: string | ReactNode;
  cell: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  className?: string;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  key: string;
  direction: SortDirection;
}

// ============================================
// Data Table Component - Clean, Modern Design
// ============================================

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  // Sorting
  sortable?: boolean;
  onSort?: (sort: SortState | null) => void;
  sortState?: SortState | null;
  // Selection
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedKeys: string[]) => void;
  // Loading
  isLoading?: boolean;
  loadingRows?: number;
  // Empty state
  emptyState?: ReactNode;
  // Styling
  className?: string;
  stickyHeader?: boolean;
  compact?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  // Row click
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  sortable = false,
  onSort,
  sortState,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  isLoading = false,
  loadingRows = 5,
  emptyState,
  className,
  stickyHeader = false,
  compact = false,
  striped = false,
  hoverable = true,
  onRowClick,
}: DataTableProps<T>) {
  const allKeys = data.map(keyExtractor);
  const allSelected = allKeys.length > 0 && allKeys.every((key) => selectedRows.includes(key));
  const someSelected = allKeys.some((key) => selectedRows.includes(key));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(allKeys);
    }
  };

  const handleSelectRow = (key: string) => {
    if (selectedRows.includes(key)) {
      onSelectionChange?.(selectedRows.filter((k) => k !== key));
    } else {
      onSelectionChange?.([...selectedRows, key]);
    }
  };

  const handleSort = (key: string) => {
    if (!sortable || !onSort) return;

    if (sortState?.key === key) {
      if (sortState.direction === "asc") {
        onSort({ key, direction: "desc" });
      } else if (sortState.direction === "desc") {
        onSort(null);
      } else {
        onSort({ key, direction: "asc" });
      }
    } else {
      onSort({ key, direction: "asc" });
    }
  };

  const getSortIcon = (key: string) => {
    if (sortState?.key !== key) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />;
    }
    if (sortState.direction === "asc") {
      return <ChevronUp className="h-3.5 w-3.5 text-[var(--accent-primary)]" />;
    }
    return <ChevronDown className="h-3.5 w-3.5 text-[var(--accent-primary)]" />;
  };

  const cellPadding = compact ? "px-4 py-2.5" : "px-6 py-4";

  return (
    <div className={cn("overflow-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]", className)}>
      <table className="w-full">
        <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
          <tr className="border-b border-[var(--border-primary)]">
            {selectable && (
              <th className={cn("w-12", cellPadding)}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={handleSelectAll}
                  size="sm"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider",
                  cellPadding,
                  column.width && `w-[${column.width}]`,
                  column.align === "center" && "text-center",
                  column.align === "right" && "text-right",
                  column.sortable && sortable && "cursor-pointer select-none hover:text-[var(--text-secondary)] transition-colors",
                  column.className
                )}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div
                  className={cn(
                    "flex items-center gap-1.5",
                    column.align === "center" && "justify-center",
                    column.align === "right" && "justify-end"
                  )}
                >
                  {column.header}
                  {column.sortable && sortable && getSortIcon(column.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: loadingRows }).map((_, index) => (
              <tr key={`loading-${index}`} className="border-b border-[var(--border-primary)] last:border-0">
                {selectable && (
                  <td className={cellPadding}>
                    <Skeleton className="h-5 w-5 rounded" />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className={cellPadding}>
                    <Skeleton className="h-5 w-full max-w-[200px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            // Empty state
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-6 py-16 text-center"
              >
                {emptyState || (
                  <div className="text-[var(--text-tertiary)]">No hay datos para mostrar</div>
                )}
              </td>
            </tr>
          ) : (
            // Data rows
            data.map((row, index) => {
              const key = keyExtractor(row);
              const isSelected = selectedRows.includes(key);

              return (
                <tr
                  key={key}
                  className={cn(
                    "border-b border-[var(--border-primary)] last:border-0 transition-colors",
                    striped && index % 2 === 1 && "bg-[var(--bg-secondary)]",
                    isSelected && "bg-[var(--accent-primary-light)]",
                    hoverable && !isSelected && "hover:bg-[var(--bg-tertiary)]",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td
                      className={cellPadding}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectRow(key)}
                        size="sm"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "text-sm text-[var(--text-primary)]",
                        cellPadding,
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        column.className
                      )}
                    >
                      {column.cell(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Simple Table (without complex features)
// ============================================

interface SimpleTableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: SimpleTableProps) {
  return (
    <div className={cn("overflow-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]", className)}>
      <table className="w-full">{children}</table>
    </div>
  );
}

export function TableHeader({ children, className }: SimpleTableProps) {
  return (
    <thead className={cn("border-b border-[var(--border-primary)]", className)}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: SimpleTableProps) {
  return (
    <tbody className={className}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className, onClick }: SimpleTableProps & { onClick?: () => void }) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border-primary)] last:border-0 transition-colors hover:bg-[var(--bg-tertiary)]",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

interface TableCellProps extends SimpleTableProps {
  align?: "left" | "center" | "right";
}

export function TableHead({ children, className, align = "left" }: TableCellProps) {
  return (
    <th
      className={cn(
        "px-6 py-4 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className, align = "left" }: TableCellProps) {
  return (
    <td
      className={cn(
        "px-6 py-4 text-sm text-[var(--text-primary)]",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </td>
  );
}
