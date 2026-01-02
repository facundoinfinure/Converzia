"use client";

import { ReactNode } from "react";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { DataTable, Column, SortState } from "./Table";
import { MobileCardList, MobileCardSkeleton } from "./MobileCard";
import { cn } from "@/lib/utils";

// ============================================
// ResponsiveList - Adaptive list component
// Desktop: DataTable with columns
// Mobile: MobileCard list
// ============================================

interface ResponsiveListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  
  // Desktop: DataTable configuration
  columns: Column<T>[];
  sortable?: boolean;
  sortState?: SortState | null;
  onSort?: (sort: SortState | null) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (keys: string[]) => void;
  stickyHeader?: boolean;
  compact?: boolean;
  
  // Mobile: Custom card renderer
  renderMobileItem: (item: T, index: number) => ReactNode;
  mobileGap?: "sm" | "md" | "lg";
  
  // Shared
  isLoading?: boolean;
  loadingCount?: number;
  emptyState?: ReactNode;
  onItemClick?: (item: T) => void;
  className?: string;
}

export function ResponsiveList<T>({
  data,
  keyExtractor,
  columns,
  sortable = false,
  sortState,
  onSort,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  stickyHeader = false,
  compact = false,
  renderMobileItem,
  mobileGap = "md",
  isLoading = false,
  loadingCount = 5,
  emptyState,
  onItemClick,
  className,
}: ResponsiveListProps<T>) {
  const isMobile = useIsMobile();

  // Loading state
  if (isLoading) {
    if (isMobile) {
      return (
        <MobileCardList gap={mobileGap} className={className}>
          {Array.from({ length: loadingCount }).map((_, i) => (
            <MobileCardSkeleton key={i} />
          ))}
        </MobileCardList>
      );
    }
    
    return (
      <DataTable
        data={[]}
        columns={columns}
        keyExtractor={keyExtractor}
        isLoading={true}
        loadingRows={loadingCount}
        className={className}
      />
    );
  }

  // Empty state
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Mobile view
  if (isMobile) {
    return (
      <MobileCardList gap={mobileGap} className={className}>
        {data.map((item, index) => (
          <div key={keyExtractor(item)}>
            {renderMobileItem(item, index)}
          </div>
        ))}
      </MobileCardList>
    );
  }

  // Desktop view
  return (
    <DataTable
      data={data}
      columns={columns}
      keyExtractor={keyExtractor}
      sortable={sortable}
      sortState={sortState}
      onSort={onSort}
      selectable={selectable}
      selectedRows={selectedRows}
      onSelectionChange={onSelectionChange}
      stickyHeader={stickyHeader}
      compact={compact}
      emptyState={emptyState}
      onRowClick={onItemClick}
      className={className}
    />
  );
}

// ============================================
// ResponsiveListHeader - Header with filters
// Desktop: Inline filters
// Mobile: Compact with filter button
// ============================================

interface ResponsiveListHeaderProps {
  // Search
  searchComponent?: ReactNode;
  
  // Filters
  filterComponent?: ReactNode;
  mobileFilterTrigger?: ReactNode;
  
  // Actions
  actions?: ReactNode;
  
  className?: string;
}

export function ResponsiveListHeader({
  searchComponent,
  filterComponent,
  mobileFilterTrigger,
  actions,
  className,
}: ResponsiveListHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <div className={cn("p-4 border-b border-border", className)}>
      {isMobile ? (
        // Mobile layout: stacked
        <div className="space-y-3">
          {/* Search row */}
          {searchComponent && (
            <div className="flex gap-2">
              <div className="flex-1">{searchComponent}</div>
              {mobileFilterTrigger}
            </div>
          )}
          
          {/* Actions row */}
          {actions && (
            <div className="flex items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </div>
      ) : (
        // Desktop layout: horizontal
        <div className="flex flex-col lg:flex-row gap-4">
          {searchComponent && (
            <div className="flex-1 max-w-md">{searchComponent}</div>
          )}
          
          <div className="flex items-center gap-3">
            {filterComponent}
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ResponsiveListContainer - Card wrapper
// ============================================

interface ResponsiveListContainerProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function ResponsiveListContainer({
  children,
  header,
  footer,
  className,
}: ResponsiveListContainerProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        className
      )}
    >
      {header}
      
      <div className={cn(isMobile && "p-4")}>
        {children}
      </div>
      
      {footer && (
        <div className="p-4 border-t border-border">
          {footer}
        </div>
      )}
    </div>
  );
}

