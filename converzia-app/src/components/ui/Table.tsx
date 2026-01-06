"use client"

import * as React from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

import { cn } from "@/lib/utils"

// ============================================
// Base Table Components (defined first)
// ============================================

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

// ============================================
// Sort State Type
// ============================================

interface SortState {
  column: string | null
  direction: "asc" | "desc" | null
}

// ============================================
// Column Definition Type
// ============================================

interface Column<T = object> {
  key: string
  header: string
  sortable?: boolean
  width?: string
  align?: "left" | "center" | "right"
  render?: (row: T, index: number) => React.ReactNode
  cell?: (row: T, index: number) => React.ReactNode  // alias for render
}

// ============================================
// DataTable Component
// ============================================

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyField?: keyof T | ((row: T) => string)
  keyExtractor?: (row: T) => string  // alias for keyField function form
  sortState?: SortState
  onSortChange?: (state: SortState) => void
  isLoading?: boolean
  loadingRows?: number  // number of skeleton rows to show when loading
  emptyMessage?: string
  emptyState?: React.ReactNode  // alias for custom empty state
  className?: string
  rowClassName?: string | ((row: T) => string)
  onRowClick?: (row: T) => void
  stickyHeader?: boolean  // make header sticky
}

function DataTable<T extends object>({
  data,
  columns,
  keyField = "id" as keyof T,
  keyExtractor,
  sortState,
  onSortChange,
  isLoading = false,
  loadingRows = 5,
  emptyMessage = "No hay datos",
  emptyState,
  className,
  rowClassName,
  onRowClick,
  stickyHeader = false,
}: DataTableProps<T>) {
  const getRowKey = (row: T, index: number): string => {
    if (keyExtractor) {
      return keyExtractor(row)
    }
    if (typeof keyField === "function") {
      return keyField(row)
    }
    const key = (row as Record<string, unknown>)[keyField as string]
    return key != null ? String(key) : String(index)
  }

  const handleSort = (columnKey: string) => {
    if (!onSortChange) return

    let newDirection: "asc" | "desc" | null = "asc"
    if (sortState?.column === columnKey) {
      if (sortState.direction === "asc") {
        newDirection = "desc"
      } else if (sortState.direction === "desc") {
        newDirection = null
      }
    }

    onSortChange({
      column: newDirection ? columnKey : null,
      direction: newDirection,
    })
  }

  const getSortIcon = (columnKey: string) => {
    if (sortState?.column !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
    }
    if (sortState.direction === "asc") {
      return <ArrowUp className="h-4 w-4" />
    }
    return <ArrowDown className="h-4 w-4" />
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <Table className={className}>
          <TableHeader className={stickyHeader ? "sticky top-0 z-10 bg-background" : ""}>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(loadingRows)].map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (data.length === 0) {
    if (emptyState) {
      return <>{emptyState}</>
    }
    return (
      <div className="w-full py-12 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto">
      <Table className={className}>
        <TableHeader className={stickyHeader ? "sticky top-0 z-10 bg-background" : ""}>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                style={{ width: col.width }}
                className={cn(
                  col.align === "center" && "text-center",
                  col.align === "right" && "text-right",
                  col.sortable && "cursor-pointer select-none hover:bg-muted/50"
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <div className={cn(
                  "flex items-center gap-2",
                  col.align === "center" && "justify-center",
                  col.align === "right" && "justify-end"
                )}>
                  {col.header}
                  {col.sortable && getSortIcon(col.key)}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={getRowKey(row, index)}
              className={cn(
                onRowClick && "cursor-pointer",
                typeof rowClassName === "function" ? rowClassName(row) : rowClassName
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right"
                  )}
                >
                  {(col.render || col.cell) ? (col.render || col.cell)!(row, index) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  DataTable,
  type Column,
  type SortState,
}
