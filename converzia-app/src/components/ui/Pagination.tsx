"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Select } from "./Select";

// ============================================
// Pagination Component
// ============================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Optional
  pageSize?: number;
  totalItems?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
  showInfo?: boolean;
  showFirstLast?: boolean;
  siblingCount?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 20,
  totalItems,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSize = true,
  showInfo = true,
  showFirstLast = true,
  siblingCount = 1,
  className,
}: PaginationProps) {
  // Generate page numbers to display
  const generatePages = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    const leftSibling = Math.max(currentPage - siblingCount, 2);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages - 1);

    // Add ellipsis if needed before range
    if (leftSibling > 2) {
      pages.push("ellipsis");
    }

    // Add pages in range
    for (let i = leftSibling; i <= rightSibling; i++) {
      if (i > 1 && i < totalPages) {
        pages.push(i);
      }
    }

    // Add ellipsis if needed after range
    if (rightSibling < totalPages - 1) {
      pages.push("ellipsis");
    }

    // Always show last page if more than 1 page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = generatePages();

  const startItem = totalItems ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 px-2",
        className
      )}
    >
      {/* Left side: Page size selector and info */}
      <div className="flex items-center gap-4">
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Mostrar</span>
            <Select
              value={pageSize.toString()}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              options={pageSizeOptions.map((size) => ({
                value: size.toString(),
                label: size.toString(),
              }))}
              selectSize="sm"
              className="w-20"
            />
          </div>
        )}

        {showInfo && totalItems !== undefined && (
          <span className="text-sm text-slate-500">
            {startItem}-{endItem} de {totalItems}
          </span>
        )}
      </div>

      {/* Right side: Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        {showFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Previous page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="w-9 h-9 flex items-center justify-center text-slate-500"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors",
                  page === currentPage
                    ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                    : "text-slate-400 hover:text-white hover:bg-card-border"
                )}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Mobile: current page indicator */}
        <span className="sm:hidden text-sm text-slate-400 px-2">
          {currentPage} / {totalPages}
        </span>

        {/* Next page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        {showFirstLast && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Simple Pagination (minimal)
// ============================================

interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: SimplePaginationProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Anterior
      </Button>

      <span className="text-sm text-slate-400 px-4">
        Página {currentPage} de {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Siguiente
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}


